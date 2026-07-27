from celery import Celery
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')

app = Celery('leads')
app.config_from_object('django.conf:settings', namespace='CELERY')

@app.task
def periodic_lead_scouting():
    from agents.scoutAgent import scoutAgent
    scoutAgent.discoverAndStore({
        'query': 'business',
        'location': 'Dubai',
        'city': 'Dubai',
        'country': 'AE',
        'industry': '',
        'maxResults': 50,
        'source': 'periodic_scouting'
    })

@app.task
def cleanup_old_sessions():
    import redis
    r = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379'))
    keys = r.keys('session:*')
    for key in keys:
        last_used = r.hget(key, 'lastUsed')
        if last_used:
            import time
            if time.time() - float(last_used) > 3600:
                r.delete(key)

if __name__ == '__main__':
    pass
