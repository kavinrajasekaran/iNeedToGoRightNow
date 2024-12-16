# models.py

from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    username = Column(String(50), primary_key=True)
    password = Column(String(128), nullable=False)

    comments = relationship('Comment', back_populates='user', cascade="all, delete-orphan")
    bathroom_codes = relationship('BathroomCode', back_populates='user', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(username='{self.username}')>"

class Bathroom(Base):
    __tablename__ = 'bathrooms'

    place_id = Column(String(100), primary_key=True)

    comments = relationship('Comment', back_populates='bathroom', cascade="all, delete-orphan")
    bathroom_codes = relationship('BathroomCode', back_populates='bathroom', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Bathroom(place_id='{self.place_id}')>"

class Comment(Base):
    __tablename__ = 'comments'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), ForeignKey('users.username'), nullable=False)
    place_id = Column(String(100), ForeignKey('bathrooms.place_id'), nullable=False)
    content = Column(String(500), nullable=False)
    timestamp = Column(DateTime, nullable=False)

    user = relationship('User', back_populates='comments')
    bathroom = relationship('Bathroom', back_populates='comments')

    def __repr__(self):
        return f"<Comment(id={self.id}, user='{self.username}', bathroom='{self.place_id}')>"

class BathroomCode(Base):
    __tablename__ = 'bathroom_codes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), ForeignKey('users.username'), nullable=False)
    place_id = Column(String(100), ForeignKey('bathrooms.place_id'), nullable=False)
    code = Column(String(50), nullable=False)
    works_or_not = Column(Boolean, nullable=False)
    timestamp = Column(DateTime, nullable=False)

    user = relationship('User', back_populates='bathroom_codes')
    bathroom = relationship('Bathroom', back_populates='bathroom_codes')

    def __repr__(self):
        return f"<BathroomCode(id={self.id}, user='{self.username}', bathroom='{self.place_id}', works={self.works_or_not})>"

class AuthToken(Base):
    __tablename__ = 'auth_tokens'

    token_id = Column(String(64), primary_key=True)
    username = Column(String(50), ForeignKey('users.username'), nullable=False)

    user = relationship('User', backref='auth_tokens')

    def __repr__(self):
        return f"<AuthToken(token_id='{self.token_id}', username='{self.username}')>"