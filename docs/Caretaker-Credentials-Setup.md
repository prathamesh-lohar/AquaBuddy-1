# Caretaker Credentials Setup Guide

## 🔐 Setting Up Caretaker Credentials

Since the caretaker system uses Firebase Authentication, you'll need to create caretaker accounts in Firebase and add their data to Firestore.

## 📋 Sample Caretaker Credentials

Here are some sample caretaker accounts you can create for testing:

### 1. **Dr. Sarah Johnson** (Doctor)
```
Email: dr.sarah@aquabuddy.com
Password: DrSarah123!
Role: DOCTOR
Facility: General Hospital
```

### 2. **Nurse Maria Garcia** (Nurse)
```
Email: nurse.maria@aquabuddy.com
Password: NurseMaria123!
Role: NURSE
Facility: General Hospital
```

### 3. **John Smith** (Family Caregiver)
```
Email: john.smith@family.com
Password: JohnSmith123!
Role: FAMILY
Facility: N/A (Home Care)
```

### 4. **Lisa Anderson** (Professional Caregiver)
```
Email: lisa.caregiver@eldercare.com
Password: LisaCare123!
Role: CAREGIVER
Facility: ElderCare Center
```

## 🛠️ How to Create Caretaker Accounts

### Step 1: Firebase Authentication
1. Go to Firebase Console → Authentication
2. Create new users with the emails above
3. Set their passwords

### Step 2: Firestore Database
Create documents in the `caretakers` collection:

```javascript
// Document ID: {user_uid_from_firebase_auth}
{
  email: "dr.sarah@aquabuddy.com",
  name: "Dr. Sarah Johnson",
  role: "DOCTOR",
  facilityId: "general-hospital-001",
  facilityName: "General Hospital",
  permissions: [
    "view_all_patients",
    "edit_patient_goals",
    "manage_devices",
    "view_reports",
    "emergency_access"
  ],
  phone: "+1-555-0123",
  createdAt: new Date(),
  updatedAt: new Date()
}
```

## 🚀 Quick Setup Script

Here's a sample setup you can use for development:

```javascript
// Sample Firebase setup script
const setupCaretakers = async () => {
  const caretakers = [
    {
      email: "dr.sarah@aquabuddy.com",
      password: "DrSarah123!",
      profile: {
        name: "Dr. Sarah Johnson",
        role: "DOCTOR",
        facilityName: "General Hospital",
        permissions: ["view_all_patients", "edit_patient_goals", "manage_devices"]
      }
    },
    {
      email: "nurse.maria@aquabuddy.com", 
      password: "NurseMaria123!",
      profile: {
        name: "Nurse Maria Garcia",
        role: "NURSE", 
        facilityName: "General Hospital",
        permissions: ["view_assigned_patients", "basic_monitoring"]
      }
    }
  ];

  // Create accounts and profiles
  for (const caretaker of caretakers) {
    // 1. Create auth account
    // 2. Create Firestore profile
    // 3. Link them together
  }
};
```

## 🧪 For Development/Testing

If you want to test the caretaker login immediately, I can create a mock authentication system that doesn't require Firebase setup:

**Development Credentials:**
- Email: `admin@caretaker.com`
- Password: `admin123`

Would you like me to:
1. Create a development/mock version with hardcoded credentials?
2. Help you set up the Firebase configuration with these sample accounts?
3. Create an automated setup script to initialize the caretaker data?

## 🔑 Default Development Credentials

For immediate testing, here are the credentials I'll set up:

### **Healthcare Admin**
- **Email:** `admin@healthcare.com`
- **Password:** `admin123`
- **Role:** DOCTOR
- **Access:** Full system access

### **Nurse Station**  
- **Email:** `nurse@healthcare.com`
- **Password:** `nurse123`
- **Role:** NURSE
- **Access:** Patient monitoring and basic alerts

### **Family Account**
- **Email:** `family@caregiver.com` 
- **Password:** `family123`
- **Role:** FAMILY
- **Access:** Limited to assigned family members

Let me know which approach you'd prefer!