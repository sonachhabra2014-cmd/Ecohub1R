from django.urls import path
from . import views
from .views import dispose_item
from .views import OrderBagsView


urlpatterns = [
    path("register/", views.register_user, name="register"),
    path("login/", views.login_user, name="login"),
    path("reset-password/", views.reset_password, name="reset_password"),
    path("company-registration/", views.company_registration, name="company_registration"),
    path("company/approve/<uuid:token>/", views.approve_company, name="approve_company"),
    path("company/reject/<uuid:token>/", views.reject_company, name="reject_company"),
    path("approved_companies/", views.approved_companies, name="approved_companies"),
    path("company/<uuid:company_id>/", views.company_profile, name="company_profile"),
    path("company/<uuid:company_id>/dashboard/", views.company_dashboard, name="company_dashboard"),
    path("order/<uuid:package_id>/", views.order_package, name="order_package"),
    path("orders/", views.orders_list, name="orders_list"),
    path("package/<uuid:package_id>/qr/", views.generate_qr, name="generate_qr"),
    path("order/<uuid:package_id>/activate/", views.activate_order, name="activate_order"),
    path("dispose", views.dispose_item, name="dispose_item"),
    path("api/items/", views.get_items),
    path(
    "collection-centers/",
    views.collection_centers,
    name="collection-centers"
),
    path(
    'companies/order-bags',
    OrderBagsView.as_view(),
    name='order-bags'
),

]
