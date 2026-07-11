from recommender_service import RecommenderService
svc = RecommenderService("model.pkl")

popular = ["Breaking Bad","Stranger Things","The Crown","Narcos","Ozark",
           "Better Call Saul","Peaky Blinders","House of Cards",
           "Dark","The Witcher","Black Mirror"]

for t in popular:
    result = svc.get_title_detail(t)
    print(f"{'✅' if result else '❌'} {t}")