using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    /// <inheritdoc />
    public partial class AddTutorIdentityVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdentityBirthdate",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentFile",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentNumber",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityDocumentType",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityLegalName",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentitySelfieFile",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IdentityVerificationStatus",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<string>(
                name: "IdentityVerificationNote",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "IdentityVerifiedAt",
                table: "TutorProfiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE TutorProfiles SET IdentityVerificationStatus = 'Verified' WHERE IdentityVerificationStatus = 'Pending'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdentityBirthdate",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentFile",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentNumber",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityDocumentType",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityLegalName",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentitySelfieFile",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityVerificationStatus",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityVerificationNote",
                table: "TutorProfiles");

            migrationBuilder.DropColumn(
                name: "IdentityVerifiedAt",
                table: "TutorProfiles");
        }
    }
}
