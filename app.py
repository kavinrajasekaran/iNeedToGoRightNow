# app.py

from flask import Flask, render_template, request, redirect, url_for, make_response, jsonify
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker as factory
from models import Base, User, AuthToken, BathroomCode
import hashlib, binascii, os, uuid
from datetime import datetime

app = Flask(__name__)

engine = create_engine('sqlite:///bathroom.db', echo=False)
Base.metadata.bind = engine
db_factory = factory(bind=engine)
db_conn = db_factory()

def hash_password(plaintext: str) -> str:
    salt = os.urandom(16)
    pwdhash = hashlib.pbkdf2_hmac('sha256', plaintext.encode('utf-8'), salt, 100000)
    return binascii.hexlify(salt).decode('utf-8') + binascii.hexlify(pwdhash).decode('utf-8')

def verify_password(stored_password: str, provided_password: str) -> bool:
    salt = binascii.unhexlify(stored_password[:32])
    stored_pwdhash = stored_password[32:]
    pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
    return stored_pwdhash == binascii.hexlify(pwdhash).decode('utf-8')

def create_token_for_user(username: str):
    token_id = uuid.uuid4().hex
    new_token = AuthToken(token_id=token_id, username=username)
    db_conn.add(new_token)
    db_conn.commit()
    return token_id

def get_user_from_token(token_id: str):
    t = db_conn.query(AuthToken).filter_by(token_id=token_id).first()
    if t:
        return t.user
    return None

def remove_token(token_id: str):
    t = db_conn.query(AuthToken).filter_by(token_id=token_id).first()
    if t:
        db_conn.delete(t)
        db_conn.commit()

def current_user():
    tid = request.cookies.get('token_id')
    if tid:
        return get_user_from_token(tid)
    return None

@app.route('/')
def index():
    user = current_user()
    message = request.args.get('message')
    return render_template('index.html', user=user, message=message)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = db_conn.query(User).filter_by(username=username).first()
        if user and verify_password(user.password, password):
            token_id = create_token_for_user(user.username)
            resp = make_response(redirect(url_for('index', message="Successfully logged in!")))
            resp.set_cookie('token_id', token_id, httponly=True, max_age=3600)
            return resp
        else:
            return redirect(url_for('login', message="Invalid username or password."))
    message = request.args.get('message')
    return render_template('login.html', message=message)

@app.route('/logout')
def logout():
    tid = request.cookies.get('token_id')
    if tid:
        remove_token(tid)
    resp = make_response(redirect(url_for('index', message="You have been logged out.")))
    resp.set_cookie('token_id', '', expires=0)
    return resp

@app.route('/create_account', methods=['GET', 'POST'])
def create_account():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        password_confirm = request.form.get('password_confirm')
        if password != password_confirm:
            return redirect(url_for('create_account', message="Passwords do not match."))
        existing_user = db_conn.query(User).filter_by(username=username).first()
        if existing_user:
            return redirect(url_for('create_account', message="Username already taken."))
        hashed_pw = hash_password(password)
        new_user = User(username=username, password=hashed_pw)
        db_conn.add(new_user)
        db_conn.commit()
        return redirect(url_for('login', message="Account created successfully! You can now log in."))
    message = request.args.get('message')
    return render_template('create_account.html', message=message)

# New API endpoint to save bathroom code
@app.route('/api/save_code', methods=['POST'])
def save_code():
    user = current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No input data provided'}), 400
    place_id = data.get('place_id')
    code = data.get('code')
    if not place_id or not code:
        return jsonify({'error': 'place_id and code are required'}), 400
    # Check if code already exists for this user and place
    existing_code = db_conn.query(BathroomCode).filter_by(username=user.username, place_id=place_id).first()
    if existing_code:
        existing_code.code = code
        existing_code.timestamp = datetime.now()
    else:
        new_code = BathroomCode(username=user.username, place_id=place_id, code=code, works_or_not=True, timestamp=datetime.now())
        db_conn.add(new_code)
    db_conn.commit()
    return jsonify({'success': True}), 200

# New API endpoint to get bathroom code for the current user
@app.route('/api/get_code/<place_id>', methods=['GET'])
def get_code(place_id):
    user = current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    code_entry = db_conn.query(BathroomCode).filter_by(username=user.username, place_id=place_id).first()
    if code_entry:
        return jsonify({'code': code_entry.code}), 200
    else:
        return jsonify({'code': None}), 200

if __name__ == '__main__':
    app.run(debug=True)
