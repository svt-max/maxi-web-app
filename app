# This is the new backend server for Maxi.
# It includes your OCR logic and the new "Group Pot" API.
#
# To run this:
# 1. Install Flask, Flask-SQLAlchemy, and Flask-CORS:
#    pip install Flask Flask-SQLAlchemy Flask-CORS google-cloud-vision
# 2. Set your Google credentials (if using OCR):
#    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/key.json"
# 3. Run the app:
#    python app.py
#
# Your frontend (index.html) will now be able to fetch data from this server.

import base64
import re
import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from google.cloud import vision
from datetime import datetime, timedelta
import uuid

# --- App Setup ---
app = Flask(__name__)
CORS(app)  # Allow your index.html (served from a different origin) to call this API

# --- Database Setup ---
# We'll use SQLite for a simple, single-file database.
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'maxi.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Hardcoded User for Demo ---
# In a real app, this would come from a JWT token or session.
# We'll use this to check if a user is an "admin" of a pot.
CURRENT_USER_ID = 'user-uuid-admin-001'
ADIDAS_USER_ID = 'user-uuid-adidas-002'
SARAH_USER_ID = 'user-uuid-sarah-003'


# --- Database Models (PRD 4.3) ---
# 
class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), unique=True)
    
    # --- Pot Relationships ---
    admin_pots = db.relationship('Pot', backref='admin', lazy=True)
    pots = db.relationship('Pot', secondary='pot_member', back_populates='members')
    pot_transactions = db.relationship('PotTransaction', backref='user', lazy=True)
    
    # --- NEW: Request/Feed Relationships ---
    created_requests = db.relationship('Request', backref='creator', lazy=True, foreign_keys='Request.creator_id')
    comments = db.relationship('Comment', backref='user', lazy=True)
    request_items_paid = db.relationship('RequestItem', backref='paid_by_user', lazy=True)
    participating_in = db.relationship('RequestParticipant', backref='user', lazy=True)

class Pot(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    admin_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    schedule = db.relationship('ScheduledContribution', backref='pot', uselist=False, lazy=True)
    members = db.relationship('User', secondary='pot_member', back_populates='pots')
    transactions = db.relationship('PotTransaction', backref='pot', lazy=True)

pot_member = db.Table('pot_member',
    db.Column('pot_id', db.String(36), db.ForeignKey('pot.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('user.id'), primary_key=True)
)

class ScheduledContribution(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pot_id = db.Column(db.String(36), db.ForeignKey('pot.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False, default=0)
    frequency = db.Column(db.String(20), nullable=False, default='One-Time') # "Monthly", "Weekly", "One-Time"
    due_day = db.Column(db.Integer) # 1-31 for monthly, 1-7 for weekly

class PotTransaction(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pot_id = db.Column(db.String(36), db.ForeignKey('pot.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False) # "Contribution" or "Expense"
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False) # Positive for "Contribution", Negative for "Expense"
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

# --- NEW: Unified Request & Social Feed Models (PRD 3.3, 4.2, 5.2) ---
# 

class Request(db.Model):
    """ A unified table for both Invoices and Splits (PRD 2.1) """
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = db.Column(db.String(20), nullable=False) # 'invoice' or 'split'
    title = db.Column(db.String(100), nullable=False) # "Client: Adidas" or "Dinner at Sakura"
    subtitle = db.Column(db.String(100)) # "INV-000-001" or "8 participants"
    creator_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='Pending') # Creator's status
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Invoice-specific fields (nullable)
    invoice_note = db.Column(db.Text) # "Next Steps" note (PRD 5.2)
    invoice_vat_percent = db.Column(db.Float, default=0)

    # Split-specific fields (nullable)
    split_deadline = db.Column(db.DateTime) # Consolidation timer (PRD 4.2)
    split_project_link = db.Column(db.String(200)) # Shareable link (PRD 4.2)

    # Relationships
    participants = db.relationship('RequestParticipant', backref='request', lazy=True, cascade="all, delete-orphan")
    items = db.relationship('RequestItem', backref='request', lazy=True, cascade="all, delete-orphan")
    comments = db.relationship('Comment', backref='request', lazy=True, cascade="all, delete-orphan")

class RequestParticipant(db.Model):
    """ Bridge table linking Users to Requests they are part of (PRD 4.2.2) """
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = db.Column(db.String(36), db.ForeignKey('request.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    
    # Participant-specific status
    status = db.Column(db.String(50), nullable=False, default='Pending') # 'Pending', 'Promised', 'Paid', 'Disputed'
    stage = db.Column(db.String(50), nullable=False, default='Delivered') # 'Delivered', 'Seen', 'Reacted'
    net_share = db.Column(db.Float) # Final calculated amount (PRD 4.2.1)

class RequestItem(db.Model):
    """ Line items for Invoices or Expenses for Splits (PRD 4.2 / 5.2) """
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = db.Column(db.String(36), db.ForeignKey('request.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    
    # For splits: who paid for this item? (PRD 4.2)
    paid_by_user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=True)

class Comment(db.Model):
    """ A single comment for the Social Feed (PRD 3.3) """
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = db.Column(db.String(36), db.ForeignKey('request.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    text_content = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(200), nullable=True) # For photos/GIFs
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


# --- Helper Function to Create DB and Seed Data ---
def create_db_and_seed():
    with app.app_context():
        db.create_all()
        
        # Check if users already exist
        if User.query.count() == 0:
            print("Seeding database...")
            # Create users
            admin_user = User(id=CURRENT_USER_ID, name='You (Admin)', phone_number='+1111111111')
            lisa = User(id=str(uuid.uuid4()), name='Lisa Thompson', phone_number='+2222222222')
            kevin = User(id=str(uuid.uuid4()), name='Kevin (Guest)', phone_number='+3333333333')
            james = User(id=str(uuid.uuid4()), name='James Park', phone_number='+4444444444')
            
            # --- NEW: Seed Users from PDR ---
            adidas_user = User(id=ADIDAS_USER_ID, name='98% Adidas', phone_number='+5555555555')
            sarah_user = User(id=SARAH_USER_ID, name='95% Sarah Williams', phone_number='+6666666666')
            mike_user = User(id=str(uuid.uuid4()), name='Mike Torres', phone_number='+7777777777')
            
            db.session.add_all([admin_user, lisa, kevin, james, adidas_user, sarah_user, mike_user])

            # Create Pot 1: "FC Lions Team Fees" (PRD 4.3.4)
            pot1 = Pot(id='pot-uuid-001', name='FC Lions Team Fees', admin_id=admin_user.id)
            pot1.members.extend([admin_user, lisa, kevin, james])
            db.session.add(pot1)
            schedule1 = ScheduledContribution(pot_id=pot1.id, amount=20.00, frequency='Monthly', due_day=1)
            db.session.add(schedule1)
            t1_1 = PotTransaction(pot_id=pot1.id, user_id=admin_user.id, type='Contribution', description='Admin contributed', amount=20.00)
            t1_2 = PotTransaction(pot_id=pot1.id, user_id=lisa.id, type='Contribution', description='Lisa contributed', amount=20.00)
            t1_3 = PotTransaction(pot_id=pot1.id, user_id=kevin.id, type='Contribution', description='Kevin contributed', amount=10.00)
            db.session.add_all([t1_1, t1_2, t1_3])
            
            # Create Pot 2: "Office Birthdays Q3" (PRD 4.3.4)
            pot2 = Pot(id='pot-uuid-002', name='Office Birthdays Q3', admin_id=admin_user.id)
            pot2.members.extend([admin_user, lisa, james])
            db.session.add(pot2)
            schedule2 = ScheduledContribution(pot_id=pot2.id, amount=10.00, frequency='One-Time', due_day=30)
            db.session.add(schedule2)
            t2_1 = PotTransaction(pot_id=pot2.id, user_id=admin_user.id, type='Contribution', description='Admin contributed', amount=10.00)
            t2_2 = PotTransaction(pot_id=pot2.id, user_id=lisa.id, type='Contribution', description='Lisa contributed', amount=10.00)
            t2_3 = PotTransaction(pot_id=pot2.id, user_id=james.id, type='Contribution', description='James contributed', amount=10.00)
            t2_4 = PotTransaction(pot_id=pot2.id, user_id=admin_user.id, type='Expense', description="Spent on John's Gift", amount=-25.00)
            db.session.add_all([t2_1, t2_2, t2_3, t2_4])
            
            # --- NEW: Seed Requests from PDR ---
            
            # 1. Adidas SME Invoice (PDR 8.1)
            adidas_req = Request(
                id='INV-MASTER-001',
                type='invoice',
                title='Client: You', # What Adidas sees
                subtitle='INV-000-001',
                creator_id=ADIDAS_USER_ID,
                total_amount=3025.00,
                status='Overdue',
                invoice_vat_percent=21.0
            )
            db.session.add(adidas_req)
            # Add participant (You)
            adidas_participant = RequestParticipant(
                request_id=adidas_req.id,
                user_id=CURRENT_USER_ID,
                status='Overdue',
                stage='Seen',
                net_share=3025.00
            )
            db.session.add(adidas_participant)
            # Add line items
            adidas_item_1 = RequestItem(request_id=adidas_req.id, description='Consulting services', amount=2000.00)
            adidas_item_2 = RequestItem(request_id=adidas_req.id, description='Additional support', amount=500.00)
            db.session.add_all([adidas_item_1, adidas_item_2])
            
            # 2. Sarah's Social Split (PDR 8.1)
            sarah_req = Request(
                id='SPL-MASTER-001',
                type='split',
                title='Dinner at Sakura',
                subtitle='8 participants',
                creator_id=SARAH_USER_ID,
                total_amount=1500.00,
                status='5/8 Paid' # Creator's status
            )
            db.session.add(sarah_req)
            # Add participant (You)
            sarah_participant_you = RequestParticipant(
                request_id=sarah_req.id,
                user_id=CURRENT_USER_ID,
                status='Pending', # Your status
                stage='Seen',
                net_share=187.50
            )
            # Add other participants
            sarah_participant_mike = RequestParticipant(
                request_id=sarah_req.id,
                user_id=mike_user.id,
                status='Paid',
                stage='Reacted',
                net_share=-562.50 # Mike is owed money
            )
            db.session.add_all([sarah_participant_you, sarah_participant_mike])
            # Add expenses
            sarah_item_1 = RequestItem(request_id=sarah_req.id, description='Sushi dinner at Sakura', amount=750.00, paid_by_user_id=SARAH_USER_ID)
            sarah_item_2 = RequestItem(request_id=sarah_req.id, description='Uber ride (to & from)', amount=750.00, paid_by_user_id=mike_user.id)
            db.session.add_all([sarah_item_1, sarah_item_2])
            
            db.session.commit()
            print("Database seeded!")

# --- API Endpoints: Group Pot (PRD 4.3) ---

@app.route('/api/pots', methods=['POST'])
def create_pot():
    """ API Spec 1: Create a New Pot (PRD 4.3.1) """
    data = request.json
    admin = User.query.get(CURRENT_USER_ID)
    new_pot = Pot(
        id=f'pot-uuid-{str(uuid.uuid4())[:4]}',
        name=data['name'], 
        admin_id=admin.id
    )
    new_pot.members.append(admin)
    db.session.add(new_pot)
    new_schedule = ScheduledContribution(
        pot_id=new_pot.id,
        amount=float(data['schedule']['amount']),
        frequency=data['schedule']['frequency'],
        due_day=int(data['schedule']['due_day']) if data['schedule'].get('due_day') else None
    )
    db.session.add(new_schedule)
    db.session.commit()
    return jsonify({
        'id': new_pot.id,
        'name': new_pot.name,
        'admin_id': new_pot.admin_id,
        'totalBalance': 0.00
    }), 201

@app.route('/api/pots', methods=['GET'])
def get_all_pots():
    """ NEW Endpoint: Get all pots for the current user """
    user = User.query.get(CURRENT_USER_ID)
    pots_data = []
    for pot in user.pots:
        total_balance = db.session.query(
            db.func.sum(PotTransaction.amount)
        ).filter_by(pot_id=pot.id).scalar() or 0.0
        pots_data.append({
            'id': pot.id,
            'name': pot.name,
            'totalBalance': total_balance,
            'memberCount': len(pot.members)
        })
    return jsonify(pots_data), 200

@app.route('/api/pots/<pot_id>', methods=['GET'])
def get_pot_details():
    """ API Spec 2: Get Pot Dashboard Details (PRD 4.3.3) """
    pot = Pot.query.get(pot_id)
    if not pot:
        return jsonify({'error': 'Pot not found'}), 404
    total_balance = db.session.query(
        db.func.sum(PotTransaction.amount)
    ).filter_by(pot_id=pot.id).scalar() or 0.0
    schedule = pot.schedule
    schedule_data = {
        'amount': schedule.amount,
        'frequency': schedule.frequency,
        'due_day': schedule.due_day,
        'nextDueDate': '2025-12-01T00:00:00Z' # TODO: Calculate this
    }
    tally_data = []
    for member in pot.members:
        total_paid = db.session.query(
            db.func.sum(PotTransaction.amount)
        ).filter_by(
            pot_id=pot.id, 
            user_id=member.id, 
            type='Contribution'
        ).scalar() or 0.0
        tally_data.append({
            'user_id': member.id,
            'name': member.name,
            'total_paid': total_paid
        })
    transactions = PotTransaction.query.filter_by(pot_id=pot.id).order_by(PotTransaction.date.desc()).all()
    feed_data = [{
        'id': t.id,
        'type': t.type,
        'description': t.description,
        'amount': t.amount,
        'user_name': t.user.name,
        'date': t.date.isoformat()
    } for t in transactions]
    return jsonify({
        'id': pot.id,
        'name': pot.name,
        'admin_id': pot.admin_id,
        'is_admin': pot.admin_id == CURRENT_USER_ID, # Helper for UI
        'totalBalance': total_balance,
        'schedule': schedule_data,
        'contributionTally': tally_data,
        'transactionFeed': feed_data
    }), 200
    
@app.route('/api/pots/<pot_id>/contributions', methods=['POST'])
def make_contribution():
    """ API Spec 3: Make a Contribution ("Money In") (PRD 4.3.2) """
    data = request.json
    amount = float(data['amount'])
    new_transaction = PotTransaction(
        pot_id=pot_id,
        user_id=CURRENT_USER_ID,
        type='Contribution',
        description=data.get('description', 'User contributed'),
        amount=amount
    )
    db.session.add(new_transaction)
    db.session.commit()
    total_balance = db.session.query(
        db.func.sum(PotTransaction.amount)
    ).filter_by(pot_id=pot_id).scalar() or 0.0
    return jsonify({
        'newTransaction': {
            'id': new_transaction.id,
            'type': new_transaction.type,
            'description': new_transaction.description,
            'amount': new_transaction.amount,
            'user_name': new_transaction.user.name,
            'date': new_transaction.date.isoformat()
        },
        'totalBalance': total_balance
    }), 201

@app.route('/api/pots/<pot_id>/expenses', methods=['POST'])
def log_pot_expense():
    """ API Spec 4: Log an Expense ("Money Out") (PRD 4.3.5) """
    pot = Pot.query.get(pot_id)
    if pot.admin_id != CURRENT_USER_ID:
        return jsonify({'error': 'Only admin can log expenses'}), 403
    data = request.json
    amount = float(data['amount'])
    new_transaction = PotTransaction(
        pot_id=pot_id,
        user_id=CURRENT_USER_ID,
        type='Expense',
        description=data['description'],
        amount=-abs(amount) # Ensure amount is negative
    )
    db.session.add(new_transaction)
    db.session.commit()
    total_balance = db.session.query(
        db.func.sum(PotTransaction.amount)
    ).filter_by(pot_id=pot_id).scalar() or 0.0
    return jsonify({
        'newTransaction': {
            'id': new_transaction.id,
            'type': new_transaction.type,
            'description': new_transaction.description,
            'amount': new_transaction.amount,
            'user_name': new_transaction.user.name,
            'date': new_transaction.date.isoformat()
        },
        'totalBalance': total_balance
    }), 201

@app.route('/api/pots/<pot_id>/schedule', methods=['PUT'])
def update_schedule():
    """ API Spec 5: Set/Update Scheduled Contribution (PRD 4.3.2) """
    pot = Pot.query.get(pot_id)
    if pot.admin_id != CURRENT_USER_ID:
        return jsonify({'error': 'Only admin can update schedule'}), 403
    data = request.json
    schedule = pot.schedule
    schedule.amount = float(data['amount'])
    schedule.frequency = data['frequency']
    schedule.due_day = int(data['due_day']) if data.get('due_day') else None
    db.session.commit()
    return jsonify({
        'schedule': {
            'amount': schedule.amount,
            'frequency': schedule.frequency,
            'due_day': schedule.due_day,
            'nextDueDate': '2025-12-01T00:00:00Z' # TODO: Calculate this
        }
    }), 200

# --- NEW: API Endpoints for Requests (Invoices/Splits) ---

@app.route('/api/requests/sent', methods=['GET'])
def get_sent_requests():
    """ Get all requests created by the current user (Creator Dashboard) """
    # Query the Request table where creator_id == CURRENT_USER_ID
    # This replaces the `sentRequests` array in script.js
    requests = Request.query.filter_by(creator_id=CURRENT_USER_ID).all()
    
    # We need to format this data to match what the frontend expects
    sent_requests_data = []
    for req in requests:
        # Determine icon and status color
        icon = ''
        status_color = 'text-orange-400' # default
        if req.type == 'invoice':
            icon = 'https.placehold.co/40x40/000000/FFFFFF?text=I'
            if req.status == 'Overdue':
                status_color = 'text-red-500'
        elif req.type == 'split':
            icon = 'https.placehold.co/40x40/9333ea/FFFFFF?text=S'
            if 'Paid' in req.status:
                status_color = 'text-lime-400'
        
        sent_requests_data.append({
            'id': req.id,
            'type': req.type,
            'title': req.title,
            'subtitle': req.subtitle,
            'amount': req.total_amount,
            'status': req.status,
            'statusColor': status_color,
            'icon': icon
            # We will fetch details (like items, participants) on-demand
        })
    
    return jsonify(sent_requests_data), 200

@app.route('/api/requests/received', methods=['GET'])
def get_received_requests():
    """ Get all requests where the current user is a participant (Payer Dashboard) """
    # Query the RequestParticipant table where user_id == CURRENT_USER_ID
    # This replaces the `receivedRequests` array in script.js
    participations = RequestParticipant.query.filter_by(user_id=CURRENT_USER_ID).all()
    
    received_requests_data = []
    for p in participations:
        req = p.request
        creator = req.creator # Get the User object who created this
        
        # Determine the page and icon
        page = ''
        icon = ''
        amount_to_show = p.net_share # Show the participant's net share
        
        if req.type == 'invoice':
            page = 'page-sme-invoice'
            icon = 'https.placehold.co/40x40/000000/FFFFFF?text=A' # Placeholder for creator
            amount_to_show = req.total_amount # For SME invoice, payer sees total
        elif req.type == 'split':
            page = 'page-social-split'
            icon = 'https.placehold.co/40x40/9333ea/FFFFFF?text=S' # Placeholder for creator

        received_requests_data.append({
            'id': req.id,
            'type': 'sme' if req.type == 'invoice' else 'social',
            'title': creator.name, # e.g., "98% Adidas"
            'subtitle': req.subtitle,
            'page': page,
            'amount': amount_to_show,
            'status': p.status, # Use the participant's specific status
            'icon': icon,
            'isConsolidating': req.split_deadline > datetime.utcnow() if req.split_deadline else False,
            'deadline': req.split_deadline.isoformat() if req.split_deadline else None
            # Details like expenses will be fetched on demand
        })
        
    return jsonify(received_requests_data), 200

@app.route('/api/requests/<request_id>', methods=['GET'])
def get_request_details(request_id):
    """ Get the full details for one request (for Payer or Creator detail pages) """
    req = Request.query.get(request_id)
    if not req:
        return jsonify({'error': 'Request not found'}), 404

    # Get items
    items = RequestItem.query.filter_by(request_id=req.id).all()
    items_data = [{
        'desc': item.description,
        'amount': item.amount,
        'paidBy': item.paid_by_user.name if item.paid_by_user else 'N/A'
    } for item in items]

    # Get participants (for creator's view)
    participants = RequestParticipant.query.filter_by(request_id=req.id).all()
    participants_data = [{
        'name': p.user.name,
        'status': p.status,
        'stage': p.stage,
        'net_share': p.net_share
    } for p in participants]
    
    # Get participant record for the *current user* (for payer's view)
    current_user_participant = RequestParticipant.query.filter_by(request_id=req.id, user_id=CURRENT_USER_ID).first()

    # Get comments (for social feed)
    comments = Comment.query.filter_by(request_id=req.id).order_by(Comment.created_at.asc()).all()
    comments_data = [{
        'id': c.id,
        'text': c.text_content,
        'image_url': c.image_url,
        'user_name': c.user.name,
        'created_at': c.created_at.isoformat()
    } for c in comments]
    
    details = {
        'id': req.id,
        'type': req.type,
        'title': req.title,
        'subtitle': req.subtitle,
        'total_amount': req.total_amount,
        'creator_name': req.creator.name,
        'status': req.status, # Creator's overall status
        
        # Payer-specific info (your status for this request)
        'your_participant_record': {
            'status': current_user_participant.status,
            'stage': current_user_participant.stage,
            'net_share': current_user_participant.net_share
        } if current_user_participant else None,
        
        # Creator-specific info (status of all participants)
        'all_participants': participants_data,
        
        'items': items_data,
        'comments': comments_data,
        
        # Type-specific fields
        'invoice_note': req.invoice_note,
        'invoice_vat_percent': req.invoice_vat_percent,
        'isConsolidating': req.split_deadline > datetime.utcnow() if req.split_deadline else False,
        'deadline': req.split_deadline.isoformat() if req.split_deadline else None
    }
    
    return jsonify(details), 200

@app.route('/api/requests/<request_id>/comments', methods=['POST'])
def post_comment(request_id):
    """ Add a comment to the social feed (PRD 3.3) """
    # TODO: Create a new Comment object linked to this request_id and CURRENT_USER_ID
    return jsonify({}), 201 # Placeholder

@app.route('/api/requests/invoice', methods=['POST'])
def create_invoice():
    """ Create a new SME Invoice (PRD 5.2) """
    # TODO: Get data from request.json
    # 1. Create Request object
    # 2. Create RequestItem objects
    # 3. Create RequestParticipant object for the recipient
    return jsonify({}), 201 # Placeholder

@app.route('/api/requests/split', methods=['POST'])
def create_split():
    """ Create a new Social Split (PRD 4.2) """
    # TODO: Get data from request.json
    # 1. Create Request object
    # 2. Create RequestItem objects for the creator's expenses
    # 3. Create RequestParticipant objects for all participants
    return jsonify({}), 201 # Placeholder


# --- OCR Endpoint (Merged from OCR.py) ---
# Note: This is conceptual and requires Google Cloud setup.
# client = vision.ImageAnnotatorClient() 

def parse_ocr_text(text):
    total_match = re.search(r"(?:Total|Amount Due|TOTAL)\s*[$€]?\s*(\d+\.\d{2})", text, re.IGNORECASE)
    total = float(total_match.group(1)) if total_match else 0.0
    client_match = re.search(r"Invoice To:\s*([A-Za-z\s,]+)\n", text, re.IGNORECASE)
    client_name = client_match.group(1).strip() if client_match else "Scanned Client, Inc."
    return {"client": client_name, "total": total, "full_text": text}

@app.route("/scan-invoice", methods=["POST"])
def scan_invoice():
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "Missing image data"}), 400
    try:
        # --- FAKE OCR RESPONSE FOR DEMO ---
        # This avoids needing Google Cloud credentials.
        # To use real OCR, comment out this block and uncomment the 'try' block below.
        print("--- FAKE OCR ---")
        fake_text = "Invoice To: Demo Client\nTotal: 123.45"
        parsed_data = parse_ocr_text(fake_text)
        return jsonify(parsed_data), 200
        # --- END FAKE OCR ---

        # --- REAL OCR BLOCK (requires setup) ---
        # image_data = base64.b64decode(data["image"])
        # image = vision.Image(content=image_data)
        # response = client.document_text_detection(image=image)
        # if response.error.message:
        ...
        
    except Exception as e:
        return jsonify({"error": f"An error occurred: {e}"}), 500

# --- Main Runner ---
if __name__ == "__main__":
    # Create the database and seed it on first run
    db_path = os.path.join(basedir, 'maxi.db')
    if not os.path.exists(db_path):
        create_db_and_seed()
    
    # --- MODIFICATION: Run `create_db_and_seed` every time for testing ---
    # This is helpful during development to ensure your seed data is always fresh.
    # Comment this out when you want persistence between runs.
    with app.app_context():
        db.drop_all() # Drop all tables
        create_db_and_seed() # Recreate and seed
        print("--- Database has been reset and seeded for testing! ---")
    
    app.run(debug=True, port=5000)