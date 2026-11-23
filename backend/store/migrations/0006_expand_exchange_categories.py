from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("store", "0005_alter_product_image_upload")]

    operations = [migrations.AlterField(
        model_name="exchangerequest",
        name="product_type",
        field=models.CharField(
            choices=[
                ("mobile", "Mobile"), ("laptop", "Laptop"), ("mobiles", "Mobiles"),
                ("laptops", "Laptops"), ("books", "Books"), ("tablets", "Tablets"),
                ("smart-watches", "Smart Watches"), ("headphones-earbuds", "Headphones"),
                ("cameras", "Cameras"),
            ],
            max_length=20,
        ),
    )]
