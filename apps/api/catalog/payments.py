import os
from urllib.parse import urlencode

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import CreativeWork


@csrf_exempt
def initiate_telebirr_payment(request, work_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    work = CreativeWork.objects.select_related("creator").filter(pk=work_id, published=True).first()
    if work is None:
        return JsonResponse({"error": "Work was not found"}, status=404)
    if not work.is_payable:
        return JsonResponse({"error": "This work is free"}, status=400)

    checkout_base_url = os.getenv("TELEBIRR_CHECKOUT_BASE_URL", "").strip()
    merchant_code = os.getenv("TELEBIRR_MERCHANT_CODE", "").strip()
    if not checkout_base_url or not merchant_code:
        return JsonResponse(
            {
                "error": "Telebirr checkout is not configured",
                "provider": "telebirr",
                "requiredEnv": ["TELEBIRR_CHECKOUT_BASE_URL", "TELEBIRR_MERCHANT_CODE"],
            },
            status=501,
        )

    query = urlencode(
        {
            "merchant": merchant_code,
            "work_id": work.id,
            "title": work.title,
            "amount": f"{work.price_etb:.2f}",
            "currency": "ETB",
        }
    )
    return JsonResponse(
        {
            "provider": "telebirr",
            "checkoutUrl": f"{checkout_base_url}?{query}",
            "amount": f"{work.price_etb:.2f}",
            "currency": "ETB",
        }
    )
