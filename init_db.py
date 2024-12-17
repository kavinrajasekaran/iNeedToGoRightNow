# init_db.py

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Bathroom, Comment, BathroomCode
from datetime import datetime
from app import hash_password

def init_db():
    # Delete the existing database if it exists
    db_file = 'bathroom.db'
    if os.path.exists(db_file):
        os.remove(db_file)
    
    # Create a SQLite database named 'bathroom.db'
    engine = create_engine('sqlite:///bathroom.db', echo=False)
    
    # Create all tables defined in models.py
    Base.metadata.create_all(engine)
    
    # Create a configured "Session" class
    Session = sessionmaker(bind=engine)
    
    # Create a Session
    session = Session()

    try:
        # Create test Users
        users = [
            User(username='alice', password=hash_password('alice')),
            User(username='bob', password=hash_password('bob')),
            User(username='charlie', password=hash_password('charlie')),
            User(username='diana', password=hash_password('diana')),
            User(username='eve', password=hash_password('eve')),
        ]

        # Add Users to session
        session.add_all(users)
        session.commit()

        print("Database initialized with test data.")

    except Exception as e:
        session.rollback()
        print(f"An error occurred: {e}")

    finally:
        session.close()

if __name__ == '__main__':
    init_db()
