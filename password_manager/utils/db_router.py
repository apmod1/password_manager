
from password_manager.models import UserData, RememberedDevice

class DatabaseRouter:
    """
    A router to control all database operations on models in the
    password_manager application.
    """
    def db_for_read(self, model, **hints):
        """
        Attempts to read UserData and RememberedDevice models go to dynamodb.
        """
        if model == UserData:
            return 'dynamodb'
        return 'default'

    def db_for_write(self, model, **hints):
        """
        Attempts to write UserData and RememberedDevice models go to dynamodb.
        """
        if model == UserData:
            return 'dynamodb'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """
        Allow relations if a model in the same db.
        """
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the UserData and RememberedDevice models only appear in the
        'dynamodb' database.
        """
        if model_name == 'userdata' or model_name == 'remembereddevice':
            return db == 'dynamodb'
        return db == 'default'
