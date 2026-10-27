package auth

type Action string

const (
	ActionReadTrip     Action = "read_trip"
	ActionEditTrip     Action = "edit_trip"
	ActionManageTrip   Action = "manage_trip"
	ActionInvite       Action = "invite"
	ActionManageMember Action = "manage_member"
	ActionManageGroup  Action = "manage_group"
	ActionEditContent  Action = "edit_content"
	ActionManageMoney  Action = "manage_money"
)

// Allowed is the single server-side role policy used by handlers and tests.
// Read actions are available to all members; content/money to editors/owners;
// trip settings/member management to the owner only.
func Allowed(role string, action Action) bool {
	if role == "" {
		return false
	}
	switch action {
	case ActionReadTrip:
		return role == "owner" || role == "editor" || role == "viewer"
	case ActionEditTrip, ActionInvite, ActionManageGroup, ActionEditContent, ActionManageMoney:
		return role == "owner" || role == "editor"
	case ActionManageTrip, ActionManageMember:
		return role == "owner"
	default:
		return false
	}
}
