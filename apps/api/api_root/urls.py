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
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from graphene_django.views import GraphQLView

from catalog.auth import fayda_sign_in_callback, fayda_sign_in_start, google_sign_in, profile_detail, sign_in, sign_up
from catalog.payments import initiate_telebirr_payment
from catalog.resumable import start_upload, upload_session
from catalog.uploads import download_work, my_works, record_work_play, stream_work, update_work_settings, upload_work, public_media
from graphene.validation import depth_limit_validator
from graphql import specified_rules

graphql_view = csrf_exempt(GraphQLView.as_view(graphiql=settings.DEBUG, validation_rules=(*specified_rules, depth_limit_validator(max_depth=4))))

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
    path('works/uploads/', start_upload),
    path('works/uploads/<uuid:upload_id>/', upload_session),
    path('works/mine/', my_works),
    path('works/<int:work_id>/stream/', stream_work),
    path('works/<int:work_id>/download/', download_work),
    path('works/<int:work_id>/play/', record_work_play),
    path('works/<int:work_id>/pay/', initiate_telebirr_payment),
    path('works/<int:work_id>/settings/', update_work_settings),
    path('media/<path:path>', public_media),
    path('images/<path:path>', public_media),
]
