from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from store.models import Category, Coupon, Product


class Command(BaseCommand):
    help = "Create the ReNewKart catalogue and RENEW10 coupon."

    def handle(self, *args, **options):
        categories = {
            "Mobiles": {
                "slug": "mobiles",
                "description": "Tested, trusted phones ready for a second life.",
                "image": "/images/categories/mobiles.jpg",
            },
            "Laptops": {
                "slug": "laptops",
                "description": "Powerful refurbished laptops for work and play.",
                "image": "/images/categories/laptops.jpg",
            },
            "Books": {
                "slug": "books",
                "description": "Pre-loved stories with plenty more to give.",
                "image": "/images/categories/books.jpg",
            },
            "Tablets": {
                "slug": "tablets",
                "description": "Refurbished tablets for reading, creating and staying connected.",
                "image": "/images/products/apple-ipad-9th-generation.jpg",
            },
            "Smart Watches": {
                "slug": "smart-watches",
                "description": "Quality-checked smart watches for every day.",
                "image": "/images/products/apple-watch-se.jpg",
            },
            "Headphones & Earbuds": {
                "slug": "headphones-earbuds",
                "description": "Second-life sound, carefully tested and ready to listen.",
                "image": "/images/products/boat-airdopes-441.jpg",
            },
            "Cameras": {
                "slug": "cameras",
                "description": "Inspected cameras to help capture what's next.",
                "image": "/images/products/nikon-d5600-dslr.jpg",
            },
        }

        legacy_exchange_category = Category.objects.filter(slug="exchange-zone").first()
        if legacy_exchange_category:
            if legacy_exchange_category.products.exists():
                raise CommandError(
                    "The Exchange Zone category still has products. Reassign them before refreshing the catalogue."
                )
            legacy_exchange_category.delete()

        category_objects = {}
        for name, defaults in categories.items():
            category_objects[name], _ = Category.objects.update_or_create(name=name, defaults=defaults)

        entries = [
            ("Apple iPhone 13", "Apple", "Mobiles", "like_new", 42999, 52999, 12, "1592750475338-74b7b21085ab", "A smooth, bright Super Retina display and a dual-camera system make this tested iPhone 13 a dependable everyday upgrade."),
            ("Samsung Galaxy S22", "Samsung", "Mobiles", "good", 31999, 44999, 8, "1610945265064-0e34e5519bbf", "A compact Galaxy flagship with a vivid AMOLED display and a quality-checked camera, battery and charging port."),
            ("OnePlus 10 Pro", "OnePlus", "Mobiles", "good", 27999, 39999, 6, "1598327105666-5b89351aff97", "Enjoy a fluid high-refresh display and fast everyday performance on this carefully tested OnePlus 10 Pro."),
            ("Google Pixel 7", "Google", "Mobiles", "like_new", 29999, 42999, 5, "1605236453806-6ff36851218e", "Capture crisp photos with Google's computational camera and enjoy a clean Android experience on this restored Pixel 7."),
            ("Apple iPhone 12", "Apple", "Mobiles", "good", 18999, 29999, 11, "1603891128711-11b4b03bb138", "A tested iPhone 12 with 5G support, an OLED display and a dual-camera system, ready for its next owner."),
            ("Samsung Galaxy S21", "Samsung", "Mobiles", "average", 15499, 24999, 7, "1610945264803-c22b62d2a7b3", "This inspected Galaxy S21 pairs a bright AMOLED screen with versatile cameras and reliable day-to-day performance."),
            ("OnePlus 11", "OnePlus", "Mobiles", "like_new", 38999, 56999, 4, "1511707171634-5f897ff02aa9", "A like-new OnePlus 11 with a responsive display, capable camera system and strong performance, fully checked by our team."),
            ("Redmi Note 13 Pro", "Xiaomi", "Mobiles", "good", 16999, 24999, 15, "1580910051074-3eb694886505", "A value-packed Redmi Note 13 Pro with a detailed display and long-lasting battery, cleaned and function-tested."),
            ("Samsung Galaxy A54", "Samsung", "Mobiles", "good", 18999, 28999, 9, "1592899677977-9c10ca588bbd", "A dependable Galaxy A54 with a colourful Super AMOLED display and multi-lens camera, inspected and ready to use."),
            ("Apple iPhone 14", "Apple", "Mobiles", "like_new", 48999, 62999, 3, "1512499617640-c74ae3a79d37", "A carefully restored iPhone 14 with a bright display, capable camera and battery health checked before dispatch."),
            ("MacBook Air M1", "Apple", "Laptops", "like_new", 54999, 69999, 7, "1517336714731-489689fd1ca8", "A lightweight MacBook Air with Apple M1 performance, tested keyboard, display and battery for work or study."),
            ("Dell XPS 13", "Dell", "Laptops", "good", 48999, 72999, 4, "1496181133206-80ce9b88a853", "This compact Dell XPS 13 has been checked for a responsive keyboard, healthy battery and dependable performance."),
            ("HP Pavilion 14", "HP", "Laptops", "good", 24999, 35999, 9, "1588872657578-7efd1f1555ed", "A versatile HP Pavilion 14, cleaned and tested for smooth everyday browsing, study and office work."),
            ("Dell Inspiron 15", "Dell", "Laptops", "good", 21999, 32999, 7, "1593642702821-c8da6771f0c6", "A dependable Dell Inspiron 15, cleaned and tested for everyday browsing, study and office work."),
            ("Lenovo ThinkPad X1", "Lenovo", "Laptops", "average", 38999, 59999, 3, "1593642632823-8f785ba67e45", "A business-ready ThinkPad X1 with its signature comfortable keyboard, inspected and graded honestly."),
            ("Dell Latitude 7420", "Dell", "Laptops", "good", 36999, 57999, 6, "1593642634367-d91a135587b5", "A practical, portable Dell Latitude 7420 with tested ports, webcam and keyboard, ready for work on the go."),
            ("HP EliteBook 840 G8", "HP", "Laptops", "like_new", 42999, 64999, 5, "1603302576837-37561b2e2302", "A polished EliteBook 840 G8 with a comfortable keyboard and clear display, carefully refurbished and checked."),
            ("Lenovo IdeaPad Slim 5", "Lenovo", "Laptops", "good", 34999, 49999, 8, "1515879218367-8466d910aaa4", "A slim Lenovo IdeaPad for everyday projects and entertainment, inspected for reliable performance and battery life."),
            ("MacBook Pro 13 M1", "Apple", "Laptops", "good", 62999, 84999, 2, "1498050108023-c5249f4df085", "A tested 13-inch MacBook Pro with M1 power, a sharp Retina display and a battery checked by our technicians."),
            ("ASUS VivoBook 15", "ASUS", "Laptops", "average", 24999, 36999, 10, "1587202372775-e229f172b9d7", "A roomy 15-inch VivoBook, cleaned and function-tested as an affordable laptop for home, classes or browsing."),
            ("Acer Aspire 5", "Acer", "Laptops", "good", 27999, 41999, 7, "1525547719571-a2d4ac8945e2", "A capable Acer Aspire 5 with a full-size keyboard and dependable everyday performance, quality checked before listing."),
            ("The Midnight Library", "Matt Haig", "Books", "good", 299, 499, 28, "1544947950-fa07a98d237f", "A gently pre-loved copy of Matt Haig's moving novel about choices, possibility and the lives we might have lived."),
            ("Atomic Habits", "James Clear", "Books", "like_new", 349, 599, 21, "1543002588-bfa74002ed7e", "A clean, like-new copy of James Clear's practical guide to building better habits one small step at a time."),
            ("Ikigai", "Hector Garcia", "Books", "good", 249, 399, 34, "1512820790803-83ca734da794", "A well-kept copy of this thoughtful introduction to the Japanese concept of finding purpose and joy in everyday life."),
            ("The Alchemist", "Paulo Coelho", "Books", "average", 199, 350, 16, "1519682337058-a94d519337bc", "A pre-loved paperback of Paulo Coelho's much-loved fable about following a dream and finding your own path."),
            ("Educated", "Tara Westover", "Books", "like_new", 329, 550, 13, "1495446815901-a7297e633e8d", "A like-new memoir by Tara Westover, carefully checked for clean pages and an intact cover."),
            ("Sapiens", "Yuval Noah Harari", "Books", "good", 399, 699, 18, "1516979187457-637abb4f9353", "A quality-checked copy of Yuval Noah Harari's sweeping exploration of human history and civilization."),
            ("The Psychology of Money", "Morgan Housel", "Books", "good", 299, 499, 22, "1524995997946-a1c2e315a42f", "A clean, pre-loved collection of short stories about how people think about money and make financial decisions."),
            ("The Book Thief", "Markus Zusak", "Books", "average", 249, 450, 10, "1497633762265-9d179a990aa6", "A gently read edition of Markus Zusak's memorable story, checked for readable pages and a sound binding."),
            ("Where the Crawdads Sing", "Delia Owens", "Books", "like_new", 349, 599, 14, "1532012197267-da84d127e765", "A like-new copy of Delia Owens' atmospheric novel, ready to be enjoyed by its next reader."),
            ("The Kite Runner", "Khaled Hosseini", "Books", "good", 279, 499, 12, "1476275466078-4007374efbbe", "A well-kept copy of Khaled Hosseini's moving novel, quality checked and ready for another read."),
            ("Apple iPad 9th Generation", "Apple", "Tablets", "good", 19999, 29999, 6, "1544244015-0df4b3ffc6b0", "A refurbished iPad with a bright Retina display, responsive performance and tested charging, ready for reading or study."),
            ("Apple iPad Air 4", "Apple", "Tablets", "like_new", 34999, 49999, 3, "1561154464-82e9adf32764", "A slim iPad Air with a vivid display and fast performance, carefully inspected and graded like new."),
            ("Samsung Galaxy Tab S7", "Samsung", "Tablets", "good", 27999, 42999, 4, "1510557880182-3d4d3cba35a5", "A versatile Galaxy Tab S7 with a crisp screen and tested battery, perfect for streaming and everyday tasks."),
            ("Samsung Galaxy Tab A8", "Samsung", "Tablets", "average", 14999, 22999, 8, "1585790050230-5dd28404ccb9", "An affordable Galaxy Tab A8, quality checked for reliable browsing, video and family use."),
            ("Apple Watch Series 7", "Apple", "Smart Watches", "like_new", 16999, 24999, 4, "1434494878577-86c23bcb06b9", "A like-new Apple Watch with a clear display and tested health, fitness and notification features."),
            ("Apple Watch SE", "Apple", "Smart Watches", "good", 10999, 15999, 7, "1508685096489-7aacd43bd3b1", "A well-kept Apple Watch SE with its core activity and notification features checked and ready to pair."),
            ("Samsung Galaxy Watch 4", "Samsung", "Smart Watches", "good", 8999, 14999, 6, "1523398002811-999ca8dec234", "A refurbished Galaxy Watch 4 with a responsive touch display and tested sensors, battery and connectivity."),
            ("Samsung Galaxy Watch Active2", "Samsung", "Smart Watches", "average", 7499, 12999, 5, "1523275335684-37898b6baf30", "A comfortable Galaxy Watch Active2, inspected for accurate tracking, working buttons and reliable charging."),
            ("Apple AirPods Pro", "Apple", "Headphones & Earbuds", "good", 9999, 15999, 5, "1590658268037-6bf12165a8df", "Genuine pre-owned AirPods Pro, sanitized and tested for pairing, microphones, charging and audio."),
            ("Sony WH-1000XM4", "Sony", "Headphones & Earbuds", "like_new", 16999, 24999, 3, "1505740420928-5e560c06d30e", "Premium Sony noise-cancelling headphones with tested Bluetooth, controls, cushions and battery."),
            ("boAt Airdopes 441", "boAt", "Headphones & Earbuds", "average", 1799, 2999, 12, "1484704849700-f032a568e944", "A budget-friendly pair of Airdopes, cleaned and checked for comfortable fit, charging and stereo sound."),
            ("JBL Tune 760NC", "JBL", "Headphones & Earbuds", "good", 4999, 7999, 8, "1546435770-a3e426bf472b", "JBL wireless headphones with tested noise cancelling, stable Bluetooth and clear everyday audio."),
            ("Canon EOS 1500D DSLR", "Canon", "Cameras", "good", 25999, 36999, 3, "1516035069371-29a1b244cc32", "A refurbished Canon DSLR, checked for sensor condition, autofocus, buttons and included battery operation."),
            ("Nikon D5600 DSLR", "Nikon", "Cameras", "average", 32999, 45999, 2, "1502920917128-1aa500764cbd", "A dependable Nikon DSLR with a tested screen, shutter, autofocus and controls, ready for another photographer."),
            ("Sony Alpha a6000", "Sony", "Cameras", "like_new", 34999, 49999, 4, "1516724562728-afc824a36e84", "A compact Sony mirrorless camera in like-new condition, inspected for sensor, viewfinder and battery performance."),
            ("Canon EOS 200D II", "Canon", "Cameras", "good", 38999, 54999, 2, "1502982720700-bfff97f2ecac", "A lightweight Canon DSLR with a tested touchscreen, autofocus and image capture, carefully checked before listing."),
        ]

        for name, brand, category, condition, price, old_price, stock, _image_id, description in entries:
            image = f"/images/products/{slugify(name)}.jpg"
            Product.objects.update_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "brand": brand,
                    "category": category_objects[category],
                    "condition": condition,
                    "price": price,
                    "old_price": old_price,
                    "stock": stock,
                    "image": image,
                    "images": [image],
                    "description": description,
                    "warranty": (
                        "Quality checked, 7-day return window"
                        if category == "Books"
                        else "6-month ReNewKart warranty"
                    ),
                },
            )
        Coupon.objects.update_or_create(code="RENEW10", defaults={"discount_percent": 10, "active": True})
        self.stdout.write(self.style.SUCCESS("Starter catalogue ready: 7 categories, 47 products, RENEW10 coupon."))
