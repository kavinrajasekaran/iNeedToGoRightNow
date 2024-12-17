# app.py

from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker
from models import Base, User, Bathroom, Comment, BathroomCode
import hashlib, binascii, os
from datetime import datetime

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

@app.route('/sidebar')
def sidebar():
    return render_template('sidebar.html')

@app.route('/bathroom_side_view', methods=['GET'])
def bathroom_side_view():
    # Retrieve parameters from query string
    name = request.args.get('name', 'Unknown Bathroom')
    address = request.args.get('address', 'Unknown Address')
    rating = request.args.get('rating', 'No Rating')
    place_id = request.args.get('placeId', '')

    if not place_id:
        return "Invalid bathroom identifier.", 400

    # Ensure the bathroom exists in the database
    bathroom = db_session.query(Bathroom).filter_by(place_id=place_id).first()
    if not bathroom:
        bathroom = Bathroom(place_id=place_id)
        db_session.add(bathroom)
        db_session.commit()

    # Fetch comments and codes ordered chronologically
    comments = db_session.query(Comment).filter_by(place_id=place_id).order_by(Comment.timestamp.desc()).all()
    codes = db_session.query(BathroomCode).filter_by(place_id=place_id).order_by(BathroomCode.timestamp.desc()).all()

    return render_template('bathroom_side_view.html', name=name, address=address, rating=rating, place_id=place_id, comments=comments, codes=codes)

@app.route('/add_comment', methods=['POST'])
def add_comment():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    data = request.get_json()
    place_id = data.get('place_id')
    content = data.get('content')

    if not place_id or not content:
        return jsonify({'success': False, 'message': 'Invalid data.'}), 400

    # Ensure the bathroom exists in the database
    bathroom = db_session.query(Bathroom).filter_by(place_id=place_id).first()
    if not bathroom:
        bathroom = Bathroom(place_id=place_id)
        db_session.add(bathroom)
        db_session.commit()

    # Create new comment
    new_comment = Comment(
        username=session['username'],
        place_id=place_id,
        content=content,
        timestamp=datetime.utcnow()
    )
    db_session.add(new_comment)
    db_session.commit()

    return jsonify({'success': True, 'message': 'Comment added successfully.'})

@app.route('/add_code', methods=['POST'])
def add_code():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    data = request.get_json()
    place_id = data.get('place_id')
    code = data.get('code')

    if not place_id or not code:
        return jsonify({'success': False, 'message': 'Invalid data.'}), 400

    # Ensure the bathroom exists in the database
    bathroom = db_session.query(Bathroom).filter_by(place_id=place_id).first()
    if not bathroom:
        bathroom = Bathroom(place_id=place_id)
        db_session.add(bathroom)
        db_session.commit()

    # Create new bathroom code
    new_code = BathroomCode(
        username=session['username'],
        place_id=place_id,
        code=code,
        timestamp=datetime.now()
    )
    db_session.add(new_code)
    db_session.commit()

    return jsonify({'success': True, 'message': 'Bathroom code added successfully.'})

@app.route('/get_top_code/<place_id>', methods=['GET'])
def get_top_code_endpoint(place_id):
    recent_code = (
        db_session.query(BathroomCode)
        .filter_by(place_id=place_id)
        .order_by(BathroomCode.timestamp.desc())
        .first()
    )

    top_code = recent_code.code if recent_code else "Unknown"

    return jsonify({'code': top_code})

@app.route('/delete_comment', methods=['POST'])
def delete_comment():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    data = request.get_json()
    comment_id = data.get('comment_id')

    if not comment_id:
        return jsonify({'success': False, 'message': 'Invalid data.'}), 400

    # Fetch the comment
    comment = db_session.query(Comment).filter_by(id=comment_id).first()
    if not comment:
        return jsonify({'success': False, 'message': 'Comment not found.'}), 404

    # Check if the current user is the owner
    if comment.username != session['username']:
        return jsonify({'success': False, 'message': 'Unauthorized action.'}), 403

    # Delete the comment
    db_session.delete(comment)
    db_session.commit()

    return jsonify({'success': True, 'message': 'Comment deleted successfully.'})

@app.route('/delete_code', methods=['POST'])
def delete_code():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    data = request.get_json()
    code_id = data.get('code_id')

    if not code_id:
        return jsonify({'success': False, 'message': 'Invalid data.'}), 400

    # Fetch the bathroom code
    code = db_session.query(BathroomCode).filter_by(id=code_id).first()
    if not code:
        return jsonify({'success': False, 'message': 'Bathroom code not found.'}), 404

    # Check if the current user is the owner
    if code.username != session['username']:
        return jsonify({'success': False, 'message': 'Unauthorized action.'}), 403

    # Delete the bathroom code
    db_session.delete(code)
    db_session.commit()

    return jsonify({'success': True, 'message': 'Bathroom code deleted successfully.'})

if __name__ == '__main__':
    app.run(debug=True)
