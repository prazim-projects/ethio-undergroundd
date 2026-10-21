"""Storage-backed media delivery, including bounded HTTP byte ranges."""
import hashlib
import mimetypes
import re

from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.utils.http import content_disposition_header


def stored_file_response(request, field, *, attachment=False):
    try:
        size = field.size
        handle = field.open("rb")
    except (FileNotFoundError, OSError, ValueError):
        return HttpResponse(status=404)
    filename = field.name.rsplit("/", 1)[-1]
    # FileField storage assigns a new name when replacing an existing file.
    etag = '"' + hashlib.sha256(f"{field.name}:{size}".encode()).hexdigest() + '"'
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    response = None
    if request.headers.get("If-None-Match") in (etag, "*"):
        handle.close()
        response = HttpResponse(status=304)
    raw_range = request.headers.get("Range", "") if request.method == "GET" else ""
    if len(raw_range) > 128:
        raw_range = ""
    if request.headers.get("If-Range", etag) != etag:
        raw_range = ""
    if response is None and raw_range and "," not in raw_range:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", raw_range)
        if match:
            first, last = match.groups()
            start = int(first) if first else max(0, size - int(last or 0))
            end = min(int(last), size - 1) if first and last else size - 1
            if (not first and not int(last or 0)) or start > end or start >= size:
                handle.close()
                response = HttpResponse(status=416)
                response["Content-Range"] = f"bytes */{size}"
            else:
                handle.seek(start)

                def chunks():
                    remaining = end - start + 1
                    try:
                        while remaining:
                            chunk = handle.read(min(64 * 1024, remaining))
                            if not chunk:
                                break
                            remaining -= len(chunk)
                            yield chunk
                    finally:
                        handle.close()

                response = StreamingHttpResponse(chunks(), status=206, content_type=content_type)
                response._resource_closers.append(handle.close)
                response["Content-Range"] = f"bytes {start}-{end}/{size}"
                response["Content-Length"] = str(end - start + 1)
    if response is None:
        if request.method == "HEAD":
            handle.close()
            response = HttpResponse(content_type=content_type)
            response["Content-Length"] = str(size)
        else:
            response = FileResponse(handle, content_type=content_type)
            response["Content-Length"] = str(size)
    response["Accept-Ranges"] = "bytes"
    response["ETag"] = etag
    response["Cache-Control"] = "private, max-age=0, must-revalidate"
    response["Content-Disposition"] = content_disposition_header(attachment, filename)
    return response
