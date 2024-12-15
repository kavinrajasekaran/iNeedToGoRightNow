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

        # Create test Bathrooms
        bathrooms = [
            Bathroom(place_id='ChIJN1t_tDeuEmsRUsoyG83frY4'),
            Bathroom(place_id='ChIJLfyY2E4awokRfw0kdE6rLlE'),
            Bathroom(place_id='ChIJd8BlQ2BZwokRAFUEcm_qrcA'),
            Bathroom(place_id='ChIJGzE9DS1awokRScdR9JcNv0Q'),
            Bathroom(place_id='ChIJVXealLU_xkcRja_At0z9AGY'),
        ]

        # Add Users and Bathrooms to session
        session.add_all(users)
        session.add_all(bathrooms)
        session.commit()

        # Create test Comments
        comments = [
            Comment(username='alice', place_id='ChIJN1t_tDeuEmsRUsoyG83frY4',
                    content='Clean and well-maintained.', timestamp=datetime.now()),
            Comment(username='bob', place_id='ChIJLfyY2E4awokRfw0kdE6rLlE',
                    content='Was a bit dirty when I arrived.', timestamp=datetime.now()),
            Comment(username='charlie', place_id='ChIJd8BlQ2BZwokRAFUEcm_qrcA',
                    content='Great location, easy to find.', timestamp=datetime.now()),
            Comment(username='diana', place_id='ChIJGzE9DS1awokRScdR9JcNv0Q',
                    content='Friendly staff and clean facilities.', timestamp=datetime.now()),
            Comment(username='eve', place_id='ChIJVXealLU_xkcRja_At0z9AGY',
                    content='The code did not work for me.', timestamp=datetime.now()),
        ]

        # Create test BathroomCodes
        bathroom_codes = [
            BathroomCode(username='alice', place_id='ChIJN1t_tDeuEmsRUsoyG83frY4',
                         code='1234', works_or_not=True, timestamp=datetime.now()),
            BathroomCode(username='bob', place_id='ChIJLfyY2E4awokRfw0kdE6rLlE',
                         code='5678', works_or_not=False, timestamp=datetime.now()),
            BathroomCode(username='charlie', place_id='ChIJd8BlQ2BZwokRAFUEcm_qrcA',
                         code='9012', works_or_not=True, timestamp=datetime.now()),
            BathroomCode(username='diana', place_id='ChIJGzE9DS1awokRScdR9JcNv0Q',
                         code='3456', works_or_not=True, timestamp=datetime.now()),
            BathroomCode(username='eve', place_id='ChIJVXealLU_xkcRja_At0z9AGY',
                         code='7890', works_or_not=False, timestamp=datetime.now()),
        ]

        # Add Comments and BathroomCodes to session
        session.add_all(comments)
        session.add_all(bathroom_codes)
        session.commit()

        print("Database initialized with test data.")

    except Exception as e:
        session.rollback()
        print(f"An error occurred: {e}")

    finally:
        session.close()

if __name__ == '__main__':
    init_db()
