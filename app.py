# app.py

from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from sqlalchemy import create_engine, and_, func, case
from sqlalchemy.orm import sessionmaker
from models import Base, User, Bathroom, Comment, BathroomCode, BathroomCodeVote
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

    # For each code, fetch upvote and downvote counts
    code_data = []
    for code in codes:
        upvotes = db_session.query(func.count(BathroomCodeVote.id)).filter_by(code_id=code.id, vote_type='upvote').scalar()
        downvotes = db_session.query(func.count(BathroomCodeVote.id)).filter_by(code_id=code.id, vote_type='downvote').scalar()
        user_vote = None
        if 'username' in session:
            user_vote = db_session.query(BathroomCodeVote).filter_by(code_id=code.id, username=session['username']).first()
            if user_vote:
                user_vote = user_vote.vote_type
        code_data.append({
            'id': code.id,
            'code': code.code,
            'username': code.username,
            'timestamp': code.timestamp,
            'upvotes': upvotes,
            'downvotes': downvotes,
            'user_vote': user_vote
        })

    return render_template('bathroom_side_view.html', name=name, address=address, rating=rating, place_id=place_id, comments=comments, codes=code_data)

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
    # Calculate the vote score (upvotes - downvotes) for each bathroom code
    vote_score = (
        func.sum(
            case(
                (BathroomCodeVote.vote_type == 'upvote', 1),
                else_=0
            )
        ) - func.sum(
            case(
                (BathroomCodeVote.vote_type == 'downvote', 1),
                else_=0
            )
        )
    ).label('score')

    # Query to find the bathroom code with the highest vote score
    # If there's a tie, the newer code (with the latest timestamp) is selected
    top_code = (
        db_session.query(BathroomCode, vote_score)
        .outerjoin(BathroomCodeVote, BathroomCode.id == BathroomCodeVote.code_id)
        .filter(BathroomCode.place_id == place_id)
        .group_by(BathroomCode.id)
        .order_by(vote_score.desc(), BathroomCode.timestamp.desc())
        .first()
    )

    # Retrieve the code text if a top code exists
    top_code_text = top_code[0].code if top_code else "Unknown"

    return jsonify({'code': top_code_text})

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

# New Route to Handle Voting
@app.route('/vote_code', methods=['POST'])
def vote_code():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'You need to log in to vote on bathroom codes.'}), 401

    data = request.get_json()
    code_id = data.get('code_id')
    vote_type = data.get('vote_type')  # 'upvote' or 'downvote'

    if not code_id or vote_type not in ['upvote', 'downvote']:
        return jsonify({'success': False, 'message': 'Invalid data.'}), 400

    # Fetch the bathroom code
    code = db_session.query(BathroomCode).filter_by(id=code_id).first()
    if not code:
        return jsonify({'success': False, 'message': 'Bathroom code not found.'}), 404

    # Check if the user has already voted on this code
    existing_vote = db_session.query(BathroomCodeVote).filter_by(code_id=code_id, username=session['username']).first()

    if existing_vote:
        if existing_vote.vote_type == vote_type:
            # If the same vote type is sent, remove the vote (toggle)
            db_session.delete(existing_vote)
            db_session.commit()
            message = f"{vote_type.capitalize()} removed."
        else:
            # Update the vote type
            existing_vote.vote_type = vote_type
            existing_vote.timestamp = datetime.utcnow()
            db_session.commit()
            message = f"Vote changed to {vote_type}."
    else:
        # Create a new vote
        new_vote = BathroomCodeVote(
            code_id=code_id,
            username=session['username'],
            vote_type=vote_type,
            timestamp=datetime.utcnow()
        )
        db_session.add(new_vote)
        db_session.commit()
        message = f"{vote_type.capitalize()} added."

    # Fetch updated vote counts
    upvotes = db_session.query(func.count(BathroomCodeVote.id)).filter_by(code_id=code_id, vote_type='upvote').scalar()
    downvotes = db_session.query(func.count(BathroomCodeVote.id)).filter_by(code_id=code_id, vote_type='downvote').scalar()

    # Check if the user has a current vote
    user_vote = db_session.query(BathroomCodeVote).filter_by(code_id=code_id, username=session['username']).first()
    current_user_vote = user_vote.vote_type if user_vote else None

    return jsonify({
        'success': True,
        'message': message,
        'upvotes': upvotes,
        'downvotes': downvotes,
        'current_user_vote': current_user_vote
    })

if __name__ == '__main__':
    app.run()
