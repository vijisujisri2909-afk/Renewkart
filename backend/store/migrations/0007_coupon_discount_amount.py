from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("store", "0006_expand_exchange_categories")]

    operations = [migrations.AddField(
        model_name="coupon",
        name="discount_amount",
        field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
    )]
