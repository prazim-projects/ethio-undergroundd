from django.db import models
from django.contrib.auth.models import User


class Artist(models.Model):
    name = models.CharField(max_length=200)
    genre = models.CharField(max_length=100)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=120)

    def __str__(self) -> str:
        return self.name


class Album(models.Model):
    artist = models.ForeignKey(Artist, related_name="albums", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    release_date = models.DateField()
    cover_image = models.ImageField(upload_to="covers/", null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.title} ({self.artist.name})"


class Track(models.Model):
    album = models.ForeignKey(Album, related_name="tracks", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    audio_file = models.FileField(upload_to="tracks/")
    play_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.title} - {self.album.title}"


class CreatorProfile(models.Model):
    class ProfileType(models.TextChoices):
        LISTENER = "listener", "Regular user"
        CREATOR = "creator", "Artist / creator"

    user = models.OneToOneField(User, related_name="creator_profile", on_delete=models.CASCADE)
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
