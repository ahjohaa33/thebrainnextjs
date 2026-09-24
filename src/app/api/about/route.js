const RAW_LARAVEL_BASE_URL =
  process.env.NEXT_PUBLIC_LARAVEL_APP_URL ||
  process.env.LARAVEL_APP_URL ||
  "https://backend.ponnobd.com/api/v1/";

const LARAVEL_API_URL = RAW_LARAVEL_BASE_URL.replace(/\/+$/, "");

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch(`${LARAVEL_API_URL}/about`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json(
        {
          success: false,
          message: "Upstream error",
        },
        {
          status: res.status,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const data = await res.json();

    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[/api/about proxy]", err);

    return Response.json(
      {
        success: false,
        message: "Failed to reach upstream API",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}