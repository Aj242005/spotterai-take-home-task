from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['driver_name'] = user.driver_name or user.username
        token['company_name'] = user.company_name
        token['is_admin'] = user.is_admin
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'username': self.user.username,
            'driver_name': self.user.driver_name,
            'company_name': self.user.company_name,
            'carrier_name': self.user.carrier_name,
            'main_office_address': self.user.main_office_address,
            'home_terminal_address': self.user.home_terminal_address,
            'truck_number': self.user.truck_number,
            'trailer_number': self.user.trailer_number,
            'is_admin': self.user.is_admin,
        }
        return data

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'password', 'driver_name',
            'company_name', 'carrier_name', 'main_office_address',
            'home_terminal_address', 'truck_number', 'trailer_number'
        )

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data.get('username', validated_data['email']),
            email=validated_data['email'],
            password=validated_data['password'],
            driver_name=validated_data.get('driver_name', 'John Driver'),
            company_name=validated_data.get('company_name', 'Spotter Logistics Inc.'),
            carrier_name=validated_data.get('carrier_name', 'Spotter Transport LLC'),
            main_office_address=validated_data.get('main_office_address', '100 Logistics Way, Chicago, IL'),
            home_terminal_address=validated_data.get('home_terminal_address', '500 Transport Blvd, Dallas, TX'),
            truck_number=validated_data.get('truck_number', 'TRK-8801'),
            trailer_number=validated_data.get('trailer_number', 'TRL-9942')
        )
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'driver_name',
            'company_name', 'carrier_name', 'main_office_address',
            'home_terminal_address', 'truck_number', 'trailer_number',
            'is_admin', 'created_at'
        )
        read_only_fields = ('id', 'email', 'created_at', 'is_admin')
