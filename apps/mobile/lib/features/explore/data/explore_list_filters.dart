class ExploreListFilters {
  const ExploreListFilters({
    this.stateCodes = const [],
    this.cities = const [],
    this.facilityTypes = const [],
  });

  final List<String> stateCodes;
  final List<String> cities;
  final List<String> facilityTypes;

  bool get isEmpty =>
      stateCodes.isEmpty && cities.isEmpty && facilityTypes.isEmpty;
}

class ExploreFilterOptions {
  const ExploreFilterOptions({
    this.states = const [],
    this.facilityTypes = const [],
  });

  final List<ExploreStateOption> states;
  final List<String> facilityTypes;
}

class ExploreStateOption {
  const ExploreStateOption({required this.code, required this.name});

  final String code;
  final String name;
}

class ExploreCityOption {
  const ExploreCityOption({required this.name, required this.stateCode});

  final String name;
  final String stateCode;
}
