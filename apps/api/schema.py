import uuid

import graphene
from graphene_django import DjangoObjectType
from django.db.models import Prefetch, Q
from catalog.models import CreativeWork, CreatorProfile


class CreatorProfileType(DjangoObjectType):
    username = graphene.String()

    class Meta:
        model = CreatorProfile
        fields = "__all__"

    def resolve_username(self, info):
        return self.user.username


class CreativeWorkType(DjangoObjectType):
    class Meta:
        model = CreativeWork
        fields = "__all__"


class Query(graphene.ObjectType):
    popular_creatives = graphene.List(CreatorProfileType, limit=graphene.Int())
    load_popular_works = graphene.List(CreativeWorkType, limit=graphene.Int())
    search_works = graphene.List(CreativeWorkType, query=graphene.String(), work_type=graphene.String(), limit=graphene.Int())
    get_creator = graphene.Field(CreatorProfileType, public_id=graphene.String(required=True))
    current_creator = graphene.Field(CreatorProfileType)

    def resolve_popular_creatives(self, info, limit=3):
        profiles = CreatorProfile.objects.filter(
            Q(profile_type=CreatorProfile.ProfileType.CREATOR) | Q(works__published=True)
        ).distinct().prefetch_related(
            Prefetch("works", queryset=CreativeWork.objects.filter(published=True))
        )
        return sorted(
            profiles,
            key=lambda profile: sum(work.play_count for work in profile.works.all()),
            reverse=True,
        )[: limit or 3]

    def resolve_load_popular_works(self, info, limit=4):
        works = CreativeWork.objects.select_related("creator", "creator__user").filter(published=True)
        return sorted(works, key=lambda work: work.play_count, reverse=True)[: limit or 4]

    def resolve_search_works(self, info, query=None, work_type=None, limit=50):
        works = CreativeWork.objects.select_related("creator", "creator__user").filter(published=True)
        if work_type:
            works = works.filter(work_type__iexact=work_type)
        if query:
            works = works.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(creator__display_name__icontains=query)
                | Q(creator__location__icontains=query)
            )
        return works.order_by("-play_count", "-download_count", "-created_at")[: limit or 50]

    def resolve_get_creator(self, info, public_id):
        lookup = str(public_id).removeprefix("profile-")
        creator_query = Q(user__username=lookup)
        if lookup.isdigit():
            creator_query |= Q(pk=int(lookup))
        try:
            creator_query |= Q(public_id=uuid.UUID(lookup))
        except ValueError:
            pass
        return CreatorProfile.objects.prefetch_related(
            Prefetch("works", queryset=CreativeWork.objects.filter(published=True))
        ).filter(
            creator_query,
            Q(profile_type=CreatorProfile.ProfileType.CREATOR) | Q(works__published=True),
        ).distinct().first()

    def resolve_current_creator(self, info):
        if not info.context.user.is_authenticated:
            return None
        return CreatorProfile.objects.filter(user=info.context.user).first()

schema = graphene.Schema(query=Query)
