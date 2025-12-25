"""Test the ops endpoint review items logic."""
from datetime import datetime, timedelta
from src.database.connection import get_db
from src.database.models import ReviewQueueItem

def test_ops_reviews():
    """Test the ops reviews logic that might be failing."""
    db = next(get_db())
    
    try:
        cutoff = datetime.utcnow() - timedelta(days=14)
        
        items = db.query(ReviewQueueItem).filter(
            ReviewQueueItem.created_at >= cutoff
        ).order_by(
            ReviewQueueItem.created_at.desc()
        ).limit(100).all()
        
        print(f"Found {len(items)} review items")
        
        for i, item in enumerate(items[:5], 1):  # Test first 5
            print(f"\n--- Item {i} ---")
            print(f"ID: {item.id}")
            print(f"Status: {item.status.value if item.status else 'None'}")
            print(f"Created: {item.created_at.isoformat()}")
            
            # Access question_event relationship
            question_event = item.question_event
            print(f"Has question_event: {question_event is not None}")
            
            if question_event:
                print(f"  Question text: {question_event.question_text[:50]}...")
                print(f"  Reason code type: {type(question_event.reason_code)}")
                print(f"  Reason code: {question_event.reason_code}")
                
                # This is the problematic line
                try:
                    reason_code = question_event.reason_code.value if question_event.reason_code else None
                    print(f"  Reason code value: {reason_code}")
                except Exception as e:
                    print(f"  ❌ Error getting reason_code.value: {e}")
                
                print(f"  Top match score: {question_event.top_match_score}")
        
        print("\n✅ Test completed!")
        
    except Exception as e:
        print(f"\n❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_ops_reviews()
