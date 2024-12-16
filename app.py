# app.py

from flask import Flask, render_template, request, redirect, url_for, make_response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker as factory
from models import Base, User, AuthToken
import hashlib, binascii, os, uuid

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

if __name__ == '__main__':
    app.run(debug=True)
