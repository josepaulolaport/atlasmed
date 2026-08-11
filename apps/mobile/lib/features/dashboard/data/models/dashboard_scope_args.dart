/// The scope + filter set every Desempenho metric is fetched with
/// (spec 0014 §3 and §5).
///
/// One object, shared by every metric request, because the spec requires the
/// filters to apply uniformly: a screen where cobertura is filtered by state
/// and penetração is not would be reporting two different populations side by
/// side.
///
/// [verticalId] is never null once resolved — a dashboard never mixes two
/// linhas, so there is no "todas" option to represent.
class DashboardScopeArgs {
  const DashboardScopeArgs({
    required this.verticalId,
    this.subjectUserId,
    this.unitTypeId,
    this.managerId,
    this.repId,
    this.stateId,
    this.municipalityId,
  });

  final int verticalId;

  /// Whose desempenho — null means the signed-in user's own (spec 0014 §2).
  final int? subjectUserId;

  final int? unitTypeId;
  final int? managerId;
  final int? repId;
  final int? stateId;
  final int? municipalityId;

  bool get hasFilters =>
      unitTypeId != null ||
      managerId != null ||
      repId != null ||
      stateId != null ||
      municipalityId != null;

  DashboardScopeArgs copyWith({
    int? verticalId,
    int? subjectUserId,
    int? unitTypeId,
    int? managerId,
    int? repId,
    int? stateId,
    int? municipalityId,
    bool clearSubject = false,
    bool clearUnitType = false,
    bool clearManager = false,
    bool clearRep = false,
    bool clearState = false,
    bool clearMunicipality = false,
  }) {
    return DashboardScopeArgs(
      verticalId: verticalId ?? this.verticalId,
      subjectUserId: clearSubject
          ? null
          : (subjectUserId ?? this.subjectUserId),
      unitTypeId: clearUnitType ? null : (unitTypeId ?? this.unitTypeId),
      managerId: clearManager ? null : (managerId ?? this.managerId),
      repId: clearRep ? null : (repId ?? this.repId),
      stateId: clearState ? null : (stateId ?? this.stateId),
      municipalityId: clearMunicipality
          ? null
          : (municipalityId ?? this.municipalityId),
    );
  }

  /// Clears every filter but keeps the linha and the subject — "limpar filtros"
  /// must not silently change whose numbers are on screen.
  DashboardScopeArgs cleared() =>
      DashboardScopeArgs(verticalId: verticalId, subjectUserId: subjectUserId);

  Map<String, String> toQuery() => {
    'verticalId': '$verticalId',
    if (subjectUserId != null) 'subjectUserId': '$subjectUserId',
    if (unitTypeId != null) 'unitTypeId': '$unitTypeId',
    if (managerId != null) 'managerId': '$managerId',
    if (repId != null) 'repId': '$repId',
    if (stateId != null) 'stateId': '$stateId',
    if (municipalityId != null) 'municipalityId': '$municipalityId',
  };

  @override
  bool operator ==(Object other) =>
      other is DashboardScopeArgs &&
      other.verticalId == verticalId &&
      other.subjectUserId == subjectUserId &&
      other.unitTypeId == unitTypeId &&
      other.managerId == managerId &&
      other.repId == repId &&
      other.stateId == stateId &&
      other.municipalityId == municipalityId;

  @override
  int get hashCode => Object.hash(
    verticalId,
    subjectUserId,
    unitTypeId,
    managerId,
    repId,
    stateId,
    municipalityId,
  );
}
