import uuid

from django.db import models
from django.contrib.auth.models import User


class CreatorProfile(models.Model):
    class ProfileType(models.TextChoices):
        LISTENER = "listener", "Regular user"
        CREATOR = "creator", "Creator"

    user = models.OneToOneField(User, related_name="creator_profile", on_delete=models.CASCADE)
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    display_name = models.CharField(max_length=160)
    profile_type = models.CharField(max_length=16, choices=ProfileType.choices, default=ProfileType.LISTENER)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    disciplines = models.JSONField(default=list, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    def __str__(self) -> str:
        return self.display_name


class CreativeWork(models.Model):
    class WorkType(models.TextChoices):
        MUSIC = "music", "Music"
        PHOTOGRAPHY = "photography", "Photography"
        VISUAL_ART = "visual_art", "Visual art"
        VIDEOGRAPHY = "videography", "Videography"
        POETRY = "poetry", "Poetry"
        OTHER = "other", "Other"

    creator = models.ForeignKey(CreatorProfile, related_name="works", on_delete=models.CASCADE)
    title = models.CharField(max_length=220)
    work_type = models.CharField(max_length=32, choices=WorkType.choices)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="works/%Y/%m/")
    thumbnail = models.ImageField(upload_to="work-thumbnails/%Y/%m/", null=True, blank=True)
    is_payable = models.BooleanField(default=False)
    price_etb = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    play_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
    published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title
