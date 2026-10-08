from django.db import models
from django.contrib.auth.models import User
import uuid
from django.utils import timezone
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile


class CollectionCenter(models.Model):
    name = models.CharField(max_length=100)
    address = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __str__(self):
        return self.name

# ✅ CompanyRegistration (signup/pending companies)
class CompanyRegistration(models.Model):
    VERIFICATION_STATUS = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100)
    company_type = models.CharField(max_length=100)
    year_established = models.PositiveIntegerField(null=True, blank=True)
    website = models.URLField(blank=True)
    official_email = models.EmailField()
    contact_number = models.CharField(max_length=30)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default="India")
    representative_name = models.CharField(max_length=255)
    designation = models.CharField(max_length=100)
    representative_email = models.EmailField()
    representative_phone = models.CharField(max_length=30)
    e_waste_types = models.TextField()
    monthly_capacity = models.CharField(max_length=100)
    authorization_number = models.CharField(max_length=150, blank=True)
    facility_address = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=VERIFICATION_STATUS, default="pending")
    verification_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name} ({self.status})"


# ✅ Company (approved companies only)
class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    details = models.TextField(default="N/A")
    verified = models.BooleanField(default=True)
    registration = models.OneToOneField(
        CompanyRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_company"
    )
    approved_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name


# ✅ Package linked to Company
class Package(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("Company", on_delete=models.CASCADE, related_name="packages")
    package_name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    duration_days = models.IntegerField(default=30)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=50,
        choices=[("pending", "Pending"), ("active", "Active"), ("expired", "Expired")],
        default="pending"
    )

    def __str__(self):
        return f"{self.package_name} ({self.company.name})"


# ✅ OrderPackage (user orders a package)
class OrderPackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="orders")
    order_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("active", "Active"),
            ("expired", "Expired"),
            ("cancelled", "Cancelled"),
        ],
        default="pending"
    )

    def __str__(self):
        return f"{self.user.username} ordered {self.package.package_name}"


# ✅ User Profile
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_verified = models.BooleanField(default=False)
    verification_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    def __str__(self):
        return self.user.username


# ✅ QR Code linked to Package
class PackageQR(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package = models.OneToOneField(Package, on_delete=models.CASCADE, related_name="qr")
    qr_image = models.ImageField(upload_to="qrcodes/", blank=True)

    def save(self, *args, **kwargs):
        qr_data = f"{self.package.company.id}-{self.package.id}"
        qr_img = qrcode.make(qr_data)
        buffer = BytesIO()
        qr_img.save(buffer, format="PNG")
        file_name = f"{self.package.id}.png"
        self.qr_image.save(file_name, ContentFile(buffer.getvalue()), save=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"QR for {self.package.package_name}"


# ✅ Disposal model (NEW)
# ✅ Disposal model
class Disposal(models.Model):
    ITEM_TYPES = [
        ("mobile", "Mobile Phone"),
        ("laptop", "Laptop"),
        ("battery", "Battery"),
        ("charger", "Charging Cable"),
        ("earphones", "Earphones"),
        ("keyboard", "Keyboard"),
        ("mouse", "Mouse"),
        ("monitor", "Monitor"),
        ("printer", "Printer"),
        ("television", "Television"),
        ("usb", "USB Drive"),
        ("powerbank", "Power Bank"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("received", "Received"),
        ("recycled", "Recycled"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    disposal_id = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="disposals"
    )

    item = models.CharField(
        max_length=50,
        choices=ITEM_TYPES
    )

    instructions = models.TextField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    collection_center_confirmed = models.BooleanField(
        default=False
    )

    disposed_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.disposal_id} - {self.status}"


from django.db import models
from django.contrib.auth.models import User
import uuid
from django.utils import timezone
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile


class CollectionCenter(models.Model):
    name = models.CharField(max_length=100)
    address = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __str__(self):
        return self.name

# ✅ CompanyRegistration (signup/pending companies)
class CompanyRegistration(models.Model):
    VERIFICATION_STATUS = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100)
    company_type = models.CharField(max_length=100)
    year_established = models.PositiveIntegerField(null=True, blank=True)
    website = models.URLField(blank=True)
    official_email = models.EmailField()
    contact_number = models.CharField(max_length=30)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default="India")
    representative_name = models.CharField(max_length=255)
    designation = models.CharField(max_length=100)
    representative_email = models.EmailField()
    representative_phone = models.CharField(max_length=30)
    e_waste_types = models.TextField()
    monthly_capacity = models.CharField(max_length=100)
    authorization_number = models.CharField(max_length=150, blank=True)
    facility_address = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=VERIFICATION_STATUS, default="pending")
    verification_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name} ({self.status})"


# ✅ Company (approved companies only)
class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    details = models.TextField(default="N/A")
    verified = models.BooleanField(default=True)
    registration = models.OneToOneField(
        CompanyRegistration,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_company"
    )
    approved_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name


# ✅ Package linked to Company
class Package(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("Company", on_delete=models.CASCADE, related_name="packages")
    package_name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    duration_days = models.IntegerField(default=30)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=50,
        choices=[("pending", "Pending"), ("active", "Active"), ("expired", "Expired")],
        default="pending"
    )

    def __str__(self):
        return f"{self.package_name} ({self.company.name})"


# ✅ OrderPackage (user orders a package)
class OrderPackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="orders")
    order_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("active", "Active"),
            ("expired", "Expired"),
            ("cancelled", "Cancelled"),
        ],
        default="pending"
    )

    def __str__(self):
        return f"{self.user.username} ordered {self.package.package_name}"


# ✅ User Profile
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_verified = models.BooleanField(default=False)
    verification_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    def __str__(self):
        return self.user.username


# ✅ QR Code linked to Package
class PackageQR(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package = models.OneToOneField(Package, on_delete=models.CASCADE, related_name="qr")
    qr_image = models.ImageField(upload_to="qrcodes/", blank=True)

    def save(self, *args, **kwargs):
        qr_data = f"{self.package.company.id}-{self.package.id}"
        qr_img = qrcode.make(qr_data)
        buffer = BytesIO()
        qr_img.save(buffer, format="PNG")
        file_name = f"{self.package.id}.png"
        self.qr_image.save(file_name, ContentFile(buffer.getvalue()), save=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"QR for {self.package.package_name}"


# ✅ Disposal model (NEW)
# ✅ Disposal model
class Disposal(models.Model):
    ITEM_TYPES = [
        ("mobile", "Mobile Phone"),
        ("laptop", "Laptop"),
        ("battery", "Battery"),
        ("charger", "Charging Cable"),
        ("earphones", "Earphones"),
        ("keyboard", "Keyboard"),
        ("mouse", "Mouse"),
        ("monitor", "Monitor"),
        ("printer", "Printer"),
        ("television", "Television"),
        ("usb", "USB Drive"),
        ("powerbank", "Power Bank"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("received", "Received"),
        ("recycled", "Recycled"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    disposal_id = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="disposals"
    )

    item = models.CharField(
        max_length=50,
        choices=ITEM_TYPES
    )

    instructions = models.TextField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    collection_center_confirmed = models.BooleanField(
        default=False
    )

    disposed_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.disposal_id} - {self.status}"

class EcoBag(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE
    )

    order = models.ForeignKey(
        EcoBagOrder,
        on_delete=models.CASCADE
    )

    bag_id = models.CharField(
        max_length=100,
        unique=True
    )

    is_used = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.bag_id

class EcoBagOrder(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE
    )

    quantity = models.IntegerField()

    seed_type = models.CharField(
        max_length=100
    )

    batch_code = models.CharField(
        max_length=100,
        unique=True
    )

    status = models.CharField(
        max_length=30,
        default="pending"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.batch_code

class EcoBag(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE
    )

    order = models.ForeignKey(
        'EcoBagOrder',
        on_delete=models.CASCADE
    )

    bag_id = models.CharField(
        max_length=100,
        unique=True
    )

    is_used = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.bag_id