import 'dart:io';

import '../external/cupertino_http_repository_http_client.dart'
    hide BearerToken, TokenBuilder;
import '../external/http_repository_http_client.dart';
import '../infra/repository_http_client.dart';

RepositoryHttpClient createPlatformHttpClient({TokenBuilder? tokenBuilder}) =>
    Platform.isIOS
    ? CupertinoHttpRepositoryHttpClient(tokenBuilder: tokenBuilder)
    : HttpRepositoryHttpClient(tokenBuilder: tokenBuilder);
