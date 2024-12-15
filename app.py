# app.py

from flask import Flask, render_template, request, redirect, url_for, flash, session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User
import hashlib, binascii, os

app = Flask(__name__)
app.secret_key = '480918'

# Database setup
engine = create_engine('sqlite:///bathroom.db', echo=False)
Base.metadata.bind = engine
DBSession = sessionmaker(bind=engine)
db_session = DBSession()

def hash_password(plaintext: str) -> str:
    """Hash a password using SHA-256 with salt."""
    salt = os.urandom(16)
    pwdhash = hashlib.pbkdf2_hmac('sha256', plaintext.encode('utf-8'), salt, 100000)
    return binascii.hexlify(salt).decode('utf-8') + binascii.hexlify(pwdhash).decode('utf-8')

def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify a stored password against one provided by user."""
    salt = binascii.unhexlify(stored_password[:32])
    stored_pwdhash = stored_password[32:]
    pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
    return stored_pwdhash == binascii.hexlify(pwdhash).decode('utf-8')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = db_session.query(User).filter_by(username=username).first()
        if user and verify_password(user.password, password):
            session['username'] = user.username
            flash("Successfully logged in!", "success")
            return redirect(url_for('index'))
        else:
            flash("Invalid username or password.", "error")
            return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    flash("You have been logged out.", "info")
    return redirect(url_for('index'))

@app.route('/create_account', methods=['GET', 'POST'])
def create_account():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        password_confirm = request.form.get('password_confirm')

        if password != password_confirm:
            flash("Passwords do not match.", "error")
            return redirect(url_for('create_account'))

        # Check if user already exists
        existing_user = db_session.query(User).filter_by(username=username).first()
        if existing_user:
            flash("Username already taken.", "error")
            return redirect(url_for('create_account'))

        # Create new user
        hashed_pw = hash_password(password)
        new_user = User(username=username, password=hashed_pw)
        db_session.add(new_user)
        db_session.commit()

        flash("Account created successfully! You can now log in.", "success")
        return redirect(url_for('login'))

    return render_template('create_account.html')

if __name__ == '__main__':
    app.run(debug=True)
