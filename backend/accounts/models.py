from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    company_name = models.CharField(max_length=255, blank=True, null=True, default='Spotter Logistics Inc.')
    carrier_name = models.CharField(max_length=255, blank=True, null=True, default='Spotter Transport LLC')
    main_office_address = models.CharField(max_length=255, blank=True, null=True, default='100 Logistics Way, Suite 400, Chicago, IL')
    home_terminal_address = models.CharField(max_length=255, blank=True, null=True, default='500 Transport Blvd, Dallas, TX')
    truck_number = models.CharField(max_length=50, blank=True, null=True, default='TRK-8801')
    trailer_number = models.CharField(max_length=50, blank=True, null=True, default='TRL-9942')
    driver_name = models.CharField(max_length=150, blank=True, null=True, default='John Driver')
    is_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.email} ({self.company_name or 'Independent'})"
