class WeeklyInteractionSummary {
  const WeeklyInteractionSummary({
    required this.distinctClinicsVisited,
    required this.totalClinics,
    required this.coveragePercentage,
    required this.weekStart,
    required this.weekEnd,
    required this.timeZone,
  });

  final int distinctClinicsVisited;
  final int totalClinics;
  final double coveragePercentage;
  final DateTime weekStart;
  final DateTime weekEnd;
  final String timeZone;

  factory WeeklyInteractionSummary.fromJson(Map<String, dynamic> json) {
    return WeeklyInteractionSummary(
      distinctClinicsVisited: json['distinctClinicsVisited'] as int,
      totalClinics: json['totalClinics'] as int,
      coveragePercentage: (json['coveragePercentage'] as num).toDouble(),
      weekStart: DateTime.parse(json['weekStart'] as String),
      weekEnd: DateTime.parse(json['weekEnd'] as String),
      timeZone: json['timeZone'] as String,
    );
  }
}
