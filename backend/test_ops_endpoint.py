"""Test script to debug ops endpoint issues."""
import sys
from datetime import datetime, timedelta
from src.database.connection import get_db
from src.database.models import ReviewQueueItem, ReviewStatus, QuestionEvent, QuestionStatus

def test_ops_summary():
    """Test the ops summary logic."""
    db = next(get_db())
    
    try:
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        
        print("Testing ops summary queries...")
        
        # Open reviews
        print("\n1. Counting open reviews...")
        open_count = db.query(ReviewQueueItem).filter(
            ReviewQueueItem.status == ReviewStatus.OPEN
        ).count()
        print(f"   Open reviews: {open_count}")
        
        # High risk open reviews
        print("\n2. Getting open items for risk assessment...")
        open_items = db.query(ReviewQueueItem).filter(
            ReviewQueueItem.status == ReviewStatus.OPEN
        ).all()
        print(f"   Total open items: {len(open_items)}")
        
        # Avg time to first response
        print("\n3. Getting recent items for response time...")
        recent_items = db.query(ReviewQueueItem).filter(
            ReviewQueueItem.created_at >= seven_days_ago,
            ReviewQueueItem.assigned_at.isnot(None)
        ).all()
        print(f"   Recent assigned items: {len(recent_items)}")
        
        if recent_items:
            total_hours = 0
            for item in recent_items:
                time_diff = item.assigned_at - item.created_at
                total_hours += time_diff.total_seconds() / 3600
            avg_hours = total_hours / len(recent_items)
            print(f"   Avg response time: {avg_hours:.2f} hours")
        else:
            print("   No recent assigned items")
        
        # Auto-answered rate
        print("\n4. Counting question events...")
        total_questions = db.query(QuestionEvent).filter(
            QuestionEvent.created_at >= seven_days_ago
        ).count()
        print(f"   Total questions (last 7 days): {total_questions}")
        
        needs_review_count = db.query(QuestionEvent).filter(
            QuestionEvent.created_at >= seven_days_ago,
            QuestionEvent.status == QuestionStatus.NEEDS_REVIEW
        ).count()
        print(f"   Needs review: {needs_review_count}")
        
        if total_questions > 0:
            answered_count = total_questions - needs_review_count
            auto_answered_rate = answered_count / total_questions
            print(f"   Auto-answered rate: {auto_answered_rate:.2%}")
        else:
            print("   No questions in last 7 days")
        
        print("\n✅ All queries completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_ops_summary()
