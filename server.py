import os
import joblib
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for all routes so the React frontend can communicate with the backend
CORS(app)

# Load the trained XGBoost model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'battery_soh_model.pkl')
print(f"Loading model from {MODEL_PATH}...")
model = joblib.load(MODEL_PATH)
print("Model loaded successfully!")

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "model_loaded": model is not None})

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400
        
        # Extract fields and validate
        required_fields = ['cycle', 'voltage', 'temperature', 'capacity', 'max_capacity']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        try:
            cycle = float(data['cycle'])
            voltage = float(data['voltage'])
            temperature = float(data['temperature'])
            capacity = float(data['capacity'])
            max_capacity = float(data['max_capacity'])
        except ValueError:
            return jsonify({"error": "Inputs must be numeric values"}), 400

        if max_capacity <= 0:
            return jsonify({"error": "max_capacity must be greater than 0"}), 400

        # Feature Engineering (must match the notebook training logic exactly)
        # 1. Capacity Loss: 1 - (capacity / max_capacity)
        capacity_loss = 1.0 - (capacity / max_capacity)
        
        # 2. Voltage × Temperature
        voltage_x_temperature = voltage * temperature
        
        # 3. Temperature / Cycle (add 1 to avoid division by zero)
        temperature_div_cycle = temperature / (cycle + 1.0)
        
        # 4. Capacity / Cycle (add 1 to avoid division by zero)
        capacity_div_cycle = capacity / (cycle + 1.0)
        
        # 5. Voltage²
        voltage_sq = voltage ** 2
        
        # 6. Temperature²
        temperature_sq = temperature ** 2
        
        # 7. Cycle²
        cycle_sq = cycle ** 2

        # Create DataFrame in the exact feature column order used in training
        # Features used: ['cycle', 'voltage', 'temperature', 'capacity', 'capacity_loss', 'voltage_x_temperature', 'temperature_div_cycle', 'capacity_div_cycle', 'voltage_sq', 'temperature_sq', 'cycle_sq']
        feature_dict = {
            'cycle': [cycle],
            'voltage': [voltage],
            'temperature': [temperature],
            'capacity': [capacity],
            'capacity_loss': [capacity_loss],
            'voltage_x_temperature': [voltage_x_temperature],
            'temperature_div_cycle': [temperature_div_cycle],
            'capacity_div_cycle': [capacity_div_cycle],
            'voltage_sq': [voltage_sq],
            'temperature_sq': [temperature_sq],
            'cycle_sq': [cycle_sq]
        }
        
        features_df = pd.DataFrame(feature_dict)
        cols_order = [
            'cycle', 'voltage', 'temperature', 'capacity', 'capacity_loss', 
            'voltage_x_temperature', 'temperature_div_cycle', 'capacity_div_cycle', 
            'voltage_sq', 'temperature_sq', 'cycle_sq'
        ]
        features_df = features_df[cols_order]

        # Run prediction (XGBoost Regressor)
        prediction = model.predict(features_df)[0]
        
        # Post-process SOH prediction (clip between 0 and 1.2 for realistic display, though model outputs raw SOH)
        soh_val = float(prediction)
        
        # Return prediction and engineered features for UI display/analysis if desired
        return jsonify({
            "soh": soh_val,
            "soh_percentage": round(soh_val * 100, 2),
            "engineered_features": {
                "capacity_loss": round(capacity_loss, 4),
                "voltage_x_temperature": round(voltage_x_temperature, 2),
                "temperature_div_cycle": round(temperature_div_cycle, 4),
                "capacity_div_cycle": round(capacity_div_cycle, 4),
                "voltage_sq": round(voltage_sq, 2),
                "temperature_sq": round(temperature_sq, 2),
                "cycle_sq": int(cycle_sq)
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run server locally on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
