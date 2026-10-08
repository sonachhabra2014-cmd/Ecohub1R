from io import BytesIO
import json
import math
import uuid
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import EmailMessage, send_mail
from django.http import JsonResponse, HttpResponse, response
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
import qrcode
from django.utils.crypto import get_random_string
from rest_framework.views import APIView
from rest_framework.response import Response

from config import settings


from .models import CompanyRegistration, Company, Disposal, EcoBagOrder, OrderPackage, CollectionCenter, Package


class OrderBagsView(APIView):
    def post(self, request):
        company_id = request.data.get('company_id')
        seed_type = str(request.data.get('seed_type', '')).strip()
        try:
            quantity = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'error': 'Quantity must be a whole number.'}, status=400)

        if not company_id or not seed_type or quantity < 1 or quantity > 10000:
            return Response({'error': 'Company, seed type, and a quantity from 1 to 10,000 are required.'}, status=400)

        company = get_object_or_404(Company, pk=company_id, verified=True)
        batch_code = f"BATCH-{uuid.uuid4().hex[:12].upper()}"
        order = EcoBagOrder.objects.create(
            company=company,
            quantity=quantity,
            seed_type=seed_type,
            batch_code=batch_code,
            status='pending'
        )
        return Response({
            'order_id': str(order.pk),
            'batch_code': order.batch_code,
            'quantity': order.quantity,
            'status': order.status
        }, status=201)
@csrf_exempt
def reset_password(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body.decode("utf-8"))
            email = data.get("email")

            print("Received data:", data)  # Debugging

            if not email:
                return JsonResponse({"error": "Email required"}, status=400)

            user = User.objects.filter(email=email).first()
            if not user:
                return JsonResponse({"error": "Email not found"}, status=400)

            new_password = get_random_string(8)
            user.set_password(new_password)
            user.save()

            send_mail(
                "EcoHub Password Reset",
                f"Your new temporary password is: {new_password}",
                getattr(settings, "DEFAULT_FROM_EMAIL", "admin@ecohub.com"),
                [email],
                fail_silently=False,
            )
            return JsonResponse({"message": "Password reset successful. Check your email."}, status=200)
        except Exception as e:
            return JsonResponse({"error": f"Server error: {str(e)}"}, status=500)

    return JsonResponse({"error": "POST required"}, status=405)


# ✅ Company Profile
def company_profile(request, company_id):
    company = get_object_or_404(Company, id=company_id)
    return render(request, "account/company_profile.html", {"company": company})




# ✅ Approve Company (from registration → company)
def approve_company(request, token):
    reg = get_object_or_404(CompanyRegistration, verification_token=token)
    reg.status = "approved"
    reg.save()


    company, created = Company.objects.get_or_create(
        registration=reg,
        defaults={
            "name": reg.company_name,
            "email": reg.official_email,
            "details": f"{reg.company_type}, {reg.city}, {reg.state}",
            "verified": True,
            "approved_at": timezone.now(),
            "approved_by": request.user if request.user.is_authenticated else None,
        }
    )
    print("Company created:", company.name, "New?", created)


    # ✅ Redirect to dashboard after approval
    return redirect("company_dashboard", company_id=company.id)




# ✅ Reject Company
def reject_company(request, token):
    reg = get_object_or_404(CompanyRegistration, verification_token=token)
    reg.status = "rejected"
    reg.save()
    return HttpResponse(
        f"<h2 style='color:red;'>❌ {reg.company_name} registration rejected.</h2>"
        f"<p>Status has been updated in the system.</p>"
    )




# ✅ Company Dashboard
def company_dashboard(request, company_id):
    company = get_object_or_404(Company, id=company_id)
    packages = company.packages.all()   # ✅ related_name="packages" hona chahiye Package model me
    orders = OrderPackage.objects.filter(package__company=company)  # ✅ company ke orders fetch karne ka sahi tarika


    return render(request, "account/company_dashboard.html", {
        "company": company,
        "packages": packages,
        "orders": orders
    })




# ✅ Order Package
def order_package(request, package_id):
    package = get_object_or_404(Package, id=package_id)
    OrderPackage.objects.create(
        user=request.user,
        package=package,
        status="pending"
    )
    return redirect("company_dashboard", company_id=package.company.id)




# ✅ Approved Companies List
def approved_companies(request):
    approved_companies = Company.objects.filter(verified=True)
    return render(request, "account/approved_companies.html", {"approved_companies": approved_companies})




# ✅ Login User
@csrf_exempt
def login_user(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Only POST requests are allowed."}, status=405)


    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")


        if not email or not password:
            return JsonResponse({"success": False, "message": "Email and password are required."}, status=400)


        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({"success": False, "message": "Invalid email or password."}, status=401)


        user = authenticate(username=user_obj.username, password=password)
        if user is not None:
            return JsonResponse({"success": True, "message": "Login successful!"}, status=200)


        return JsonResponse({"success": False, "message": "Invalid email or password."}, status=401)


    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON request."}, status=400)




# ✅ Register User
@csrf_exempt
def register_user(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Only POST requests are allowed."}, status=405)


    try:
        data = json.loads(request.body)
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")


        if not name or not email or not password:
            return JsonResponse({"success": False, "message": "Name, email and password are required."}, status=400)


        if User.objects.filter(email=email).exists():
            return JsonResponse({"success": False, "message": "An account with this email already exists."}, status=409)


        User.objects.create_user(username=email, email=email, password=password, first_name=name)
        return JsonResponse({"success": True, "message": "Account created successfully!"}, status=201)


    except Exception as error:
        print("Registration error:", error)
        return JsonResponse({"success": False, "message": "Something went wrong while creating the account."}, status=500)




# ✅ Company Registration
@csrf_exempt
def company_registration(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Only POST requests are allowed."}, status=405)


    try:
        data = json.loads(request.body)
        company = CompanyRegistration.objects.create(
            company_name=data.get("companyName", ""),
            registration_number=data.get("registrationNumber", ""),
            company_type=data.get("companyType", ""),
            year_established=data.get("yearEstablished") or None,
            website=data.get("website", ""),
            official_email=data.get("officialEmail", ""),
            contact_number=data.get("contactNumber", ""),
            address=data.get("address", ""),
            city=data.get("city", ""),
            state=data.get("state", ""),
            pin_code=data.get("pinCode", ""),
            country=data.get("country", "India"),
            representative_name=data.get("representativeName", ""),
            designation=data.get("designation", ""),
            representative_email=data.get("representativeEmail", ""),
            representative_phone=data.get("representativePhone", ""),
            e_waste_types=data.get("eWasteTypes", ""),
            monthly_capacity=data.get("monthlyCapacity", ""),
            authorization_number=data.get("authorizationNumber", ""),
            facility_address=data.get("facilityAddress", ""),
            verification_token=uuid.uuid4(),
            status="pending"
        )


        approve_link = f"http://127.0.0.1:8000/company/approve/{company.verification_token}/"
        reject_link = f"http://127.0.0.1:8000/company/reject/{company.verification_token}/"


        html_content = f"""
            <h2>New EcoHub Company Registration</h2>
            <p><b>Name:</b> {company.company_name}</p>
            <p><b>Registration Number:</b> {company.registration_number}</p>
            <p><b>Type:</b> {company.company_type}</p>
            <p><b>Year Established:</b> {company.year_established}</p>
            <p><b>Website:</b> {company.website}</p>
            <p><b>Official Email:</b> {company.official_email}</p>
            <p><b>Contact Number:</b> {company.contact_number}</p>
            <p><b>Representative:</b> {company.representative_name} ({company.designation})</p>
            <p><b>Email:</b> {company.representative_email}</p>
            <p><b>Phone:</b> {company.representative_phone}</p>
            <p><b>E-Waste Types:</b> {company.e_waste_types}</p>
            <p><b>Monthly Capacity:</b> {company.monthly_capacity}</p>
            <p><b>Authorization Number:</b> {company.authorization_number}</p>
            <p><b>Facility Address:</b> {company.facility_address}</p>
            <p>
                <a href="{approve_link}" style="background-color:green;color:white;padding:10px;text-decoration:none;">✅ Approve</a>
                <a href="{reject_link}" style="background-color:red;color:white;padding:10px;text-decoration:none;margin-left:10px;">❌ Reject</a>
            </p>
        """


        email = EmailMessage(
            subject=f"New EcoHub Company Registration - {company.company_name}",
            body=html_content,
            from_email="sonachhabra2014@gmail.com",
            to=["sonachhabra2014@gmail.com"],
        )
        email.content_subtype = "html"
        email.send()


        return JsonResponse({"success": True, "message": "Company registration submitted successfully.", "id": company.id}, status=201)


    except Exception as error:
        print("COMPANY REGISTRATION ERROR:", error)
        return JsonResponse({"success": False, "message": "Could not save company registration."}, status=500)
def orders_list(request):
    orders = OrderPackage.objects.filter(user=request.user)
    return render(request, "account/orders_list.html", {"orders": orders})


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points
    on the Earth surface in kilometers using the Haversine formula.
    """
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


@csrf_exempt
def dispose_item(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")
            item = data.get("item")

            instructions = {
                "mobile": "Take to nearest e-waste center.",
                "laptop": "Recycle at authorized e-waste facility.",
                "battery": "Drop in hazardous waste bin.",
                "plastic": "Put in blue recycling bin."
            }

            instruction = instructions.get(item, "No instruction found")
            centers = CollectionCenter.objects.all()

            user_lat = data.get("latitude") or data.get("lat")
            user_lng = data.get("longitude") or data.get("lng")
            has_gps = False
            try:
                if user_lat is not None and user_lng is not None:
                    user_lat = float(user_lat)
                    user_lng = float(user_lng)
                    has_gps = True
            except (ValueError, TypeError):
                has_gps = False

            center_data = []
            for center in centers:
                item_info = {
                    "id": center.id,
                    "name": center.name,
                    "address": center.address,
                    "latitude": center.latitude,
                    "longitude": center.longitude
                }
                if has_gps:
                    item_info["distance_km"] = calculate_haversine_distance(
                        user_lat, user_lng, center.latitude, center.longitude
                    )
                center_data.append(item_info)

            if has_gps:
                center_data.sort(key=lambda c: c["distance_km"])
                if center_data:
                    center_data[0]["is_nearest"] = True

            # Save disposal record
            user = User.objects.get(id=user_id)
            disposal_rec = Disposal.objects.create(
                user=user,
                item=item,
                instructions=instruction,
                disposal_id=f"ECO-{uuid.uuid4().hex[:8].upper()}"
            )

            return JsonResponse({
                "disposal_id": disposal_rec.disposal_id,
                "instruction": instruction,
                "collection_centers": center_data
            }, status=200)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "POST required"}, status=405)


def generate_qr(request):
    # URL ya text jo QR code me encode karna hai
    data = "http://127.0.0.1:8000/api/register/"

    # QR code generate karo
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=5
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill="black", back_color="white")

    # Image ko HTTP response me bhejo
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return HttpResponse(buffer.getvalue(), content_type="image/png")



@csrf_exempt
def activate_order(request, package_id):
    if request.method == "GET":
        # Package exist karta hai ya nahi check karo
        package = get_object_or_404(Package, id=package_id)

        # User ke pending order ko fetch karo
        order = OrderPackage.objects.filter(
            user=request.user,
            package=package,
            status="pending"
        ).first()

        if not order:
            return JsonResponse(
                {"success": False, "message": "No pending order found for this package."},
                status=404
            )

        # Status update karo
        order.status = "active"
        order.save()

        return JsonResponse(
            {"success": True, "message": "Order activated successfully!"},
            status=200
        )

    return JsonResponse({"error": "GET request required"}, status=405)


def get_items(request):
    items = [
        {"id": 1, "name": "Plastic Bottle"},
        {"id": 2, "name": "Glass"},
        {"id": 3, "name": "Paper"}
    ]
    return JsonResponse(items, safe=False)


def collection_centers(request):
    """
    Returns collection centers. If GPS coordinates (lat, lng) are provided in query params,
    computes geodesic distance (Haversine formula), sorts by proximity (closest first),
    and filters by radius (in km) if provided.
    """
    centers = CollectionCenter.objects.all()

    user_lat = request.GET.get("lat") or request.GET.get("latitude")
    user_lng = request.GET.get("lng") or request.GET.get("lon") or request.GET.get("longitude")
    radius = request.GET.get("radius")
    limit = request.GET.get("limit")

    has_gps = False
    try:
        if user_lat is not None and user_lng is not None:
            user_lat = float(user_lat)
            user_lng = float(user_lng)
            has_gps = True
    except (ValueError, TypeError):
        has_gps = False

    data = []
    for center in centers:
        item = {
            "id": center.id,
            "name": center.name,
            "address": center.address,
            "latitude": center.latitude,
            "longitude": center.longitude,
        }
        if has_gps:
            item["distance_km"] = calculate_haversine_distance(
                user_lat, user_lng, center.latitude, center.longitude
            )
        data.append(item)

    if has_gps:
        data.sort(key=lambda c: c["distance_km"])

        if radius:
            try:
                max_radius = float(radius)
                data = [c for c in data if c["distance_km"] <= max_radius]
            except (ValueError, TypeError):
                pass

        if data:
            data[0]["is_nearest"] = True

    if limit:
        try:
            max_limit = int(limit)
            data = data[:max_limit]
        except (ValueError, TypeError):
            pass

    return JsonResponse(data, safe=False)



