/// A product as the order screens display it.
///
/// Previously lived in `cart.dart` alongside `CartItem`. The cart went with the
/// order-creation flow; this stayed, because order *history* renders it.
class Product {
  final int id;
  final String name;
  final String sub;
  final double unit;
  final String category;
  final String? tag;

  const Product({
    required this.id,
    required this.name,
    required this.sub,
    required this.unit,
    required this.category,
    this.tag,
  });
}
