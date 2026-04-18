"""
数据库模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from app.core.config import settings

Base = declarative_base()
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Conversation(Base):
    """对话记录"""
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), index=True)
    visitor_id = Column(String(64), nullable=True)
    role = Column(String(20))  # user / assistant
    content = Column(Text)
    input_type = Column(String(20), default="text")  # text / voice
    emotion = Column(String(20), nullable=True)  # happy/sad/neutral/curious
    sentiment_score = Column(Float, nullable=True)
    location = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class KnowledgeDoc(Base):
    """知识库文档"""
    __tablename__ = "knowledge_docs"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200))
    category = Column(String(50))  # history/culture/route/faq
    content = Column(Text)
    file_path = Column(String(300), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AvatarConfig(Base):
    """数字人配置"""
    __tablename__ = "avatar_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    avatar_type = Column(String(50))  # guide_female/guide_male/custom
    voice_id = Column(String(100), default="Cherry")
    voice_style = Column(String(50), default="friendly")
    personality = Column(Text)  # 性格描述
    greeting = Column(Text)  # 欢迎语
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DailyStats(Base):
    """每日统计"""
    __tablename__ = "daily_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), unique=True)  # YYYY-MM-DD
    total_sessions = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    avg_satisfaction = Column(Float, default=0.0)
    top_questions = Column(JSON, default=list)
    emotion_distribution = Column(JSON, default=dict)

# 创建所有表
Base.metadata.create_all(bind=engine)
