import '../external/http_repository_http_client.dart';
import '../infra/repository_http_client.dart';

RepositoryHttpClient createPlatformHttpClient({TokenBuilder? tokenBuilder}) =>
    HttpRepositoryHttpClient(tokenBuilder: tokenBuilder);
