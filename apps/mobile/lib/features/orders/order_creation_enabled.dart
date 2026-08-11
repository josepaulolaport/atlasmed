/// Whether a rep may start a new order from anywhere in the app.
///
/// Off. Placing an order is meant to be part of an interaction, and that is not
/// modelled yet: checkout wants a clinic plus an interaction or a doctor, and
/// its clinic and doctor pickers are still stubs over empty lists. Every other
/// order-creation affordance was already removed — `order_creation_actions_test`
/// pins their absence on the orders list, the clinic history and order detail —
/// and the interaction screen was the last one left, so a rep could still reach
/// a checkout they could not finish.
///
/// The cart, checkout and `/orders/new` routes are all intact behind this. Order
/// *history* is unaffected: reading past orders was never in question.
///
/// Flip to `true` when order-interactions exist and the pickers are real.
const bool kOrderCreationEnabled = false;
