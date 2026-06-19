class ExplorePage<T> {
  const ExplorePage({
    required this.items,
    required this.hasMore,
    this.page = 1,
  });

  final List<T> items;
  final bool hasMore;
  final int page;
}

const explorePageSize = 20;
