import 'package:flutter/material.dart';

/// Shared [RouteObserver] for screens that refresh when they become visible
/// again (e.g. after a pushed route is popped).
final RouteObserver<ModalRoute<void>> appRouteObserver =
    RouteObserver<ModalRoute<void>>();
