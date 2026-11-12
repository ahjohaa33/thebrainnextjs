# Laravel deployment integration (required outside this Next.js-only ZIP)

**Not installed by this patch:** no Laravel source was present in the supplied archive, and your actual Eloquent model names/controllers are unknown. Apply the following in the Laravel application after verifying its routes and models.

## Webhook configuration

Set environment values on Laravel:

```
NEXTJS_REVALIDATE_URL=https://thebrainbd.com/api/revalidate
NEXTJS_REVALIDATE_SECRET=<same random REVALIDATE_SECRET configured in Next.js>
```

Example reusable publisher (adapt to your Laravel version/services; use after commit):

```php
<?php
namespace App\Support;

use Illuminate\Support\Facades\Http;

final class NextRevalidation
{
    public static function dispatch(string $resource, ?string $slug = null, ?string $oldSlug = null): void
    {
        $url = config('services.nextjs.revalidate_url');
        $secret = config('services.nextjs.revalidate_secret');
        if (!$url || !$secret) {
            logger()->warning('Next revalidation not configured');
            return;
        }
        try {
            Http::timeout(4)->withHeaders(['X-Revalidate-Secret' => $secret])
                ->post($url, array_filter([
                    'resource' => $resource,
                    'slug' => $slug,
                    'old_slug' => $oldSlug,
                ], fn ($v) => $v !== null && $v !== ''))
                ->throw();
        } catch (\Throwable $e) {
            report($e); // Queue/retry in production rather than losing an invalidation.
        }
    }
}
```

Add a `nextjs` section to Laravel's `config/services.php`:

```php
'nextjs' => [
    'revalidate_url' => env('NEXTJS_REVALIDATE_URL'),
    'revalidate_secret' => env('NEXTJS_REVALIDATE_SECRET'),
],
```

In the *actual* Eloquent observers for Product, Category, Blog/Post, and Menu/Nav models, implement `ShouldHandleEventsAfterCommit` and call the publisher from `created`, `updated`, `deleted` and `restored` events as applicable. Example for a product, replacing `Product` and fields if your project differs:

```php
<?php
namespace App\Observers;

use App\Models\Product;
use App\Support\NextRevalidation;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;

class ProductObserver implements ShouldHandleEventsAfterCommit
{
    public function created(Product $p): void { NextRevalidation::dispatch('product', $p->slug); }
    public function updated(Product $p): void {
        NextRevalidation::dispatch('product', $p->slug, $p->getOriginal('slug'));
    }
    public function deleted(Product $p): void { NextRevalidation::dispatch('product', $p->slug); }
    public function restored(Product $p): void { NextRevalidation::dispatch('product', $p->slug); }
}
```

Register `ProductObserver` via your Laravel `AppServiceProvider::boot()` or your project-wide event registration. Apply equivalent observers with `dispatch('category', ...)`, `dispatch('blog', ...)` and `dispatch('menu')`. Home banners, pricing, videos and other homepage content may also need a `dispatch('site')`; About and footer use `dispatch('about')` and `dispatch('footer')`. Trigger after **committed** writes, not before. Queue retries for webhook failures and verify delivery on your production deployment.

## Stock validation and order safety

The frontend intentionally never trusts the cached catalog for transaction accuracy. Laravel must:

- On `/cart/add` and cart quantity updates, load the current product and reject disabled/deleted products or requested quantities above live `current_stock`; return a 4xx JSON message for the existing frontend.
- On `/checkout`, run a database transaction, lock every cart-product inventory row (`lockForUpdate()`), recheck available quantities and pricing, write order and order lines, decrement stock in the same transaction, then commit. Do not trust client item prices or quantities; prevent double submission with a unique/idempotent order key if available.
- On failed checkout, roll back order and inventory; return a proper non-2xx response with a user-readable `message`. Preserve existing `{data: {order}}` success response structure.

**Do not treat the new Next pre-check as the authoritative stock check.** Without these Laravel changes, full live-stock correctness is incomplete.
