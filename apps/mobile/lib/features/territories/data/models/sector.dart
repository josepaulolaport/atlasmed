/// Healthcare commercial vertical (e.g. oncologia, cardiologia).
///
/// Mirrors the `Sector` DTO returned by `GET /sectors` in the real API
/// (`{ id, slug, name }`).
class Sector {
  final String id;
  final String slug;
  final String name;

  const Sector({required this.id, required this.slug, required this.name});
}
