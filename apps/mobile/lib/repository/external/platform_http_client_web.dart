import 'package:atlasmed_mobile_app/repository/external/http_repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

RepositoryHttpClient createPlatformHttpClient({TokenBuilder? tokenBuilder}) =>
    HttpRepositoryHttpClient(tokenBuilder: tokenBuilder);
