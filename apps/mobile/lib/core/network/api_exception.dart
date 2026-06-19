class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final String? code;

  const ApiException({
    required this.message,
    this.statusCode,
    this.code,
  });

  @override
  String toString() => 'ApiException($statusCode): $message';
}
