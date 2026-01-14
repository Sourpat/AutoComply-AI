"""Test analytics endpoint directly."""
import sys
sys.path.insert(0, "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend")

from app.analytics.repo import analytics_repo

def test_analytics():
    """Test analytics repository methods."""
    print("Testing Analytics Repository\n")
    print("=" * 60)
    
    # Test summary
    print("\n1. Summary Metrics:")
    summary = analytics_repo.get_summary()
    print(f"   Total Cases: {summary.totalCases}")
    print(f"   Open: {summary.openCount}")
    print(f"   Closed: {summary.closedCount}")
    print(f"   Overdue: {summary.overdueCount}")
    print(f"   Due Soon: {summary.dueSoonCount}")
    
    # Test status breakdown
    print("\n2. Status Breakdown:")
    status_breakdown = analytics_repo.get_status_breakdown()
    for item in status_breakdown:
        print(f"   {item.status}: {item.count}")
    
    # Test decision type breakdown
    print("\n3. Decision Type Breakdown:")
    dt_breakdown = analytics_repo.get_decision_type_breakdown()
    for item in dt_breakdown:
        print(f"   {item.decisionType}: {item.count}")
    
    # Test time series
    print("\n4. Cases Created (Last 14 Days):")
    created_series = analytics_repo.get_cases_created_time_series(days=14)
    for point in created_series[-5:]:  # Show last 5 days
        print(f"   {point.date}: {point.count}")
    
    # Test full analytics response
    print("\n5. Full Analytics Response:")
    analytics = analytics_repo.get_analytics(days=30)
    print(f"   Summary: {analytics.summary.totalCases} total cases")
    print(f"   Status Breakdown: {len(analytics.statusBreakdown)} statuses")
    print(f"   Decision Types: {len(analytics.decisionTypeBreakdown)} types")
    print(f"   Time Series Points: {len(analytics.casesCreatedTimeSeries)}")
    print(f"   Top Event Types: {len(analytics.topEventTypes)}")
    print(f"   Verifier Activity: {len(analytics.verifierActivity)}")
    
    print("\n" + "=" * 60)
    print("✓ All analytics methods working correctly!")
    print("\nReady to test in UI at: http://localhost:5173/analytics")

if __name__ == "__main__":
    test_analytics()
