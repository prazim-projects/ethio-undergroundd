"""
URL configuration for api_root project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from graphene_django.views import GraphQLView

from catalog.auth import fayda_sign_in_callback, fayda_sign_in_start, google_sign_in, profile_detail, sign_in, sign_up
from catalog.payments import initiate_telebirr_payment
from catalog.uploads import download_track, download_work, my_works, record_track_play, record_work_play, stream_track, stream_work, update_work_settings, upload_work

graphql_view = csrf_exempt(GraphQLView.as_view(graphiql=True))

urlpatterns = [
    path('admin/', admin.site.urls),
    path('graphql', graphql_view),
    path('graphql/', graphql_view),
    path('auth/sign-up/', sign_up),
    path('auth/sign-in/', sign_in),
    path('auth/google/', google_sign_in),
    path('auth/fayda/start/', fayda_sign_in_start),
    path('auth/fayda/callback/', fayda_sign_in_callback),
    path('auth/profile/', profile_detail),
    path('works/upload/', upload_work),
    path('works/mine/', my_works),
    path('works/<int:work_id>/stream/', stream_work),
    path('works/<int:work_id>/download/', download_work),
    path('works/<int:work_id>/play/', record_work_play),
    path('works/<int:work_id>/pay/', initiate_telebirr_payment),
    path('works/<int:work_id>/settings/', update_work_settings),
    path('tracks/<int:track_id>/stream/', stream_track),
    path('tracks/<int:track_id>/download/', download_track),
    path('tracks/<int:track_id>/play/', record_track_play),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
