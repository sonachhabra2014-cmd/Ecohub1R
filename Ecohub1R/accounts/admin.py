from django.contrib import admin
from .models import CompanyRegistration, Company, Package, OrderPackage, Profile
from .models import CollectionCenter

@admin.register(CollectionCenter)
class CollectionCenterAdmin(admin.ModelAdmin):
    list_display = ("name", "address", "latitude", "longitude")
    search_fields = ("name", "address")

# ✅ CompanyRegistration admin
@admin.register(CompanyRegistration)
class CompanyRegistrationAdmin(admin.ModelAdmin):
    list_display = ("company_name", "status", "official_email", "representative_name", "submitted_at")
    list_filter = ("status", "city", "state")
    search_fields = ("company_name", "representative_name", "official_email")

# ✅ Company admin
@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "verified", "details")
    list_filter = ("verified",)
    search_fields = ("name", "email")

# ✅ Package admin
@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("package_name", "company", "price", "duration_days", "status")
    list_filter = ("status",)
    search_fields = ("package_name", "company__name")

# ✅ OrderPackage admin
@admin.register(OrderPackage)
class OrderPackageAdmin(admin.ModelAdmin):
    list_display = ("user", "package", "order_date", "status")
    list_filter = ("status",)
    search_fields = ("user__username", "package__package_name")

# ✅ Profile admin
@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "is_verified", "verification_token")
    list_filter = ("is_verified",)
    search_fields = ("user__username",)
