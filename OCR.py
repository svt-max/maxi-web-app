# This is a conceptual Python backend using Flask and Google Cloud Vision.
# This file would run on a server, not in the browser.
# You would need to install flask and google-cloud-vision:
# pip install Flask google-cloud-vision

import base64
import re
from flask import Flask, request, jsonify
from google.cloud import vision

# Initialize Flask app
app = Flask(__name__)

# Initialize Google Vision client
# This requires setting up Google Cloud authentication
# (e.g., setting GOOGLE_APPLICATION_CREDENTIALS)
client = vision.ImageAnnotatorClient()

def parse_ocr_text(text):
    """
    A simple (and fragile) regex-based parser.
    A real-world app would use more robust parsing or even a
    secondary LLM call to extract structured data.
    """
    total = None
    client_name = None

    # Try to find a total
    total_match = re.search(r"(?:Total|Amount Due|TOTAL)\s*[$€]?\s*(\d+\.\d{2})", text, re.IGNORECASE)
    if total_match:
        total = float(total_match.group(1))

    # Try to find a client name (example: looks for "Invoice To:")
    client_match = re.search(r"Invoice To:\s*([A-Za-z\s,]+)\n", text, re.IGNORECASE)
    if client_match:
        client_name = client_match.group(1).strip()

    return {
        "client": client_name or "Scanned Client, Inc.",
        "total": total or 0.00,
        "full_text": text # Send full text for debugging
    }

@app.route("/scan-invoice", methods=["POST"])
def scan_invoice():
    """
    This is the endpoint your JavaScript would call.
    It expects a JSON payload like: { "image": "base64-encoded-string" }
    """
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "Missing image data"}), 400

    # Decode the base64 image
    try:
        image_data = base64.b64decode(data["image"])
        image = vision.Image(content=image_data)
    except Exception as e:
        return jsonify({"error": f"Invalid base64 image: {e}"}), 400

    # Call Google Cloud Vision API for document OCR
    try:
        response = client.document_text_detection(image=image)
        if response.error.message:
            return jsonify({"error": response.error.message}), 500
            
        full_text = response.full_text_annotation.text
        
        # Parse the text to find key-value pairs
        parsed_data = parse_ocr_text(full_text)
        
        # Return the structured JSON to the frontend
        return jsonify(parsed_data), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred with the Vision API: {e}"}), 500

if __name__ == "__main__":
    # Note: For production, use a real WSGI server like Gunicorn
    app.run(debug=True, port=5000)