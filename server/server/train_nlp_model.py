import os
import joblib
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# ── 7 Categories and their typical bank passbook keywords ─────────────────────────
data = [
    # Food
    ("UPI/SWIGGY/9182/Ref123", "Food"),
    ("UPI/ZOMATO/FoodDelivery", "Food"),
    ("POS/DOMINOS PIZZA/MUMBAI", "Food"),
    ("UPI/KFC/123912/BLR", "Food"),
    ("NEFT/BigBasket/Groceries", "Food"),
    ("UPI/BLINKIT/Order99", "Food"),
    ("POS/UDUPI GRAND/CAFE", "Food"),
    ("UPI/MCDONALDS/PUNE", "Food"),
    
    # Travel
    ("UPI/UBER INDIA/Trip-BLR", "Travel"),
    ("UPI/OLA/AutoRide/BLR", "Travel"),
    ("NEFT/IRCTC/PNR-4521837", "Travel"),
    ("POS/INDIGO AIRLINES/DELHI", "Travel"),
    ("UPI/RAPIDO/BikeRide", "Travel"),
    ("POS/INDIAN OIL/PETROL", "Travel"),
    ("UPI/MAKEMYTRIP/Flight", "Travel"),
    ("UPI/Namma Metro/Recharge", "Travel"),
    
    # Bills
    ("NEFT/Airtel Postpaid/Oct Bill", "Bills"),
    ("NACH/BESCOM/Electricity/Oct", "Bills"),
    ("UPI/JIO RECHARGE/Prepaid", "Bills"),
    ("NEFT/LIC PREMIUM/Policy#982", "Bills"),
    ("UPI/BSNL/Broadband", "Bills"),
    ("POS/IGL GAS/Delhi", "Bills"),
    ("NEFT/SOCIETY MAINTENANCE/NOV", "Bills"),
    
    # Shopping
    ("UPI/AMAZON PAY/Order#9283", "Shopping"),
    ("UPI/FLIPKART/Order#8192", "Shopping"),
    ("POS/DMART/MUMBAI", "Shopping"),
    ("UPI/MYNTRA/Fashion", "Shopping"),
    ("POS/RELIANCE DIGITAL/BLR", "Shopping"),
    ("UPI/AJIO/Apparel", "Shopping"),
    ("POS/CROMA/Electronics", "Shopping"),
    
    # Health
    ("POS/APOLLO PHARMACY/MG ROAD", "Health"),
    ("UPI/NETMEDS/Medicines", "Health"),
    ("POS/MAX HOSPITAL/CONSULT", "Health"),
    ("UPI/1MG/HealthCheckup", "Health"),
    ("POS/MEDPLUS/Pharmacy", "Health"),
    ("NEFT/LAL PATHLABS/Test", "Health"),
    
    # Entertainment
    ("SI/Netflix Inc/Monthly Sub", "Entertainment"),
    ("UPI/BOOKMYSHOW/Movie", "Entertainment"),
    ("POS/PVR CINEMAS/BLR", "Entertainment"),
    ("UPI/SPOTIFY/Premium", "Entertainment"),
    ("SI/HOTSTAR/Yearly", "Entertainment"),
    ("UPI/STEAM GAMES/Purchase", "Entertainment"),
    
    # Other
    ("ATM/CASH WDL/Koramangala", "Other"),
    ("POS/UNKNOWN VENDOR TX-99", "Other"),
    ("INTEREST CREDIT/SB A/C", "Other"),
    ("SALARY/INFOSYS LTD/Oct-2024", "Other"),
    ("UPI/Vikas/Transfer", "Other"),
    ("NEFT/RENT/HOUSE", "Other"),
    ("IMPS/Rahul/Money", "Other"),
    ("CASH DEPOSIT/BRANCH", "Other"),
]

# Create more data to ensure stable training
augmented_data = []
for _ in range(5):
    augmented_data.extend(data)

descriptions, labels = zip(*augmented_data)

encoder = LabelEncoder()
y_encoded = encoder.fit_transform(labels)

# Keyword extraction + TF-IDF
vectorizer = TfidfVectorizer(
    analyzer='word',
    ngram_range=(1, 2), # Capture single words and bigrams for better keyword extraction
    max_features=1000,
    stop_words='english'
)

X_tfidf = vectorizer.fit_transform(descriptions)

# Train a model
model = LogisticRegression(random_state=42, max_iter=1000, class_weight='balanced')
model.fit(X_tfidf, y_encoded)

# Predict to show metrics
y_pred = model.predict(X_tfidf)
print(classification_report(y_encoded, y_pred, target_names=encoder.classes_))

# Save the models
model_dir = Path(__file__).resolve().parent / "ml_models"
model_dir.mkdir(parents=True, exist_ok=True)

joblib.dump(model, model_dir / "nlp_categorizer.pkl")
joblib.dump(vectorizer, model_dir / "tfidf_vectorizer.pkl")
joblib.dump(encoder, model_dir / "nlp_label_encoder.pkl")

print(f"Models successfully saved to {model_dir}")
